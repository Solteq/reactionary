import { z } from 'zod';
import { Session } from '../schemas/session.schema';
import { BaseQuery } from '../schemas/queries/base.query';
import { BaseMutation } from '../schemas/mutations/base.mutation';
import { BaseModel } from '../schemas/models/base.model';
import { createProviderInstrumentation } from '@reactionary/otel';
import { Cache } from '../cache/cache.interface';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import * as crypto from 'crypto';

/**
 * Base capability provider, responsible for mutations (changes) and queries (fetches)
 * for a given business object domain.
 */
export abstract class BaseProvider<
  T extends BaseModel = BaseModel,
  Q extends BaseQuery = BaseQuery,
  M extends BaseMutation = BaseMutation
> {
  protected instrumentation: ReturnType<typeof createProviderInstrumentation>;
  protected cache: Cache;
  
  constructor(
    public readonly schema: z.ZodType<T>, 
    public readonly querySchema: z.ZodType<Q, Q>, 
    public readonly mutationSchema: z.ZodType<M, M>,
    cache: Cache
  ) {
    this.instrumentation = createProviderInstrumentation(this.constructor.name);
    this.cache = cache;
  }

  /**
   * Validates that the final domain model constructed by the provider
   * fulfills the schema as defined. This will throw an exception.
   */
  protected assert(value: T) {
    return this.schema.parse(value);
  }

  /**
   * Creates a new model entity based on the schema defaults.
   */
  protected newModel(): T {
    return this.schema.parse({});
  }

  /**
   * Retrieves a set of entities matching the list of queries. The size of
   * the resulting list WILL always match the size of the query list. The
   * result list will never contain nulls or undefined. The order
   * of the results will match the order of the queries.
   */
  public async query(queries: Q[], session: Session): Promise<T[]> {
    return this.instrumentation.traceQuery(
      'query',
      async (span) => {
        span.setAttribute('provider.query.count', queries.length);
        
        let cacheHits = 0;
        let cacheMisses = 0;
        const results: T[] = [];

        // Process each query individually for cache efficiency
        for (const query of queries) {
          let result: T | null = null;
          
          // Get cache evaluation from provider
          const cacheInfo = this.getCacheEvaluation(query, session);
          
          // Try cache first if caching is enabled
          if (cacheInfo.canCache && cacheInfo.key) {
            try {
              result = await this.cache.get(cacheInfo.key, this.schema);
              if (result) {
                cacheHits++;
                span.setAttribute('provider.cache.hit', true);
              }
            } catch (error) {
              // Cache error shouldn't break the query - log and continue
              console.warn(`Cache get error for ${this.constructor.name}:`, error);
            }
          }
          
          // If not in cache, fetch from source
          if (!result) {
            const singleResult = await this.fetch([query], session);
            result = singleResult[0];
            cacheMisses++;
            
            // Store in cache if caching is enabled
            if (result && cacheInfo.canCache && cacheInfo.key) {
              try {
                await this.cache.put(cacheInfo.key, result, cacheInfo.cacheDurationInSeconds);
              } catch (error) {
                // Cache put error shouldn't break the query - log and continue
                console.warn(`Cache put error for ${this.constructor.name}:`, error);
              }
            }
          }
          
          if (result) {
            this.assert(result);
            results.push(result);
          }
        }

        span.setAttribute('provider.result.count', results.length);
        span.setAttribute('provider.cache.hits', cacheHits);
        span.setAttribute('provider.cache.misses', cacheMisses);
        span.setAttribute('provider.cache.hit_ratio', cacheHits / (cacheHits + cacheMisses));
        
        return results;
      },
      { queryCount: queries.length }
    );
  }

  /**
   * Executes the listed mutations in order and returns the final state
   * resulting from that set of operations.
   */
  public async mutate(mutations: M[], session: Session): Promise<T> {
    return this.instrumentation.traceMutation(
      'mutate',
      async (span) => {
        span.setAttribute('provider.mutation.count', mutations.length);
        
        // Perform the mutation
        const result = await this.process(mutations, session);
        this.assert(result);

        // Invalidate related cache entries using provider-specific logic
        let invalidatedKeys = 0;
        for (const mutation of mutations) {
          try {
            const keysToInvalidate = this.getInvalidationKeys(mutation, session);
            if (keysToInvalidate.length > 0) {
              await this.cache.del(keysToInvalidate);
              invalidatedKeys += keysToInvalidate.length;
            }
          } catch (error) {
            console.warn(`Cache invalidation error for ${this.constructor.name}:`, error);
          }
        }
        span.setAttribute('provider.cache.invalidated_keys', invalidatedKeys);

        return result;
      },
      { mutationCount: mutations.length }
    );
  }

  /**
   * The internal extension point for providers implementating query
   * capabilities.
   */
  protected abstract fetch(queries: Q[], session: Session): Promise<T[]>;

  /**
   * The internal extension point for providers implementing mutation
   * capabilities.
   */
  protected abstract process(
    mutations: M[],
    session: Session
  ): Promise<T>;

  /**
   * Provider-specific cache evaluation logic.
   * Returns information about how this query should be cached.
   * Default implementation returns no caching.
   */
  protected getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    // Default: generate a cache key but don't cache
    const key = this.generateCacheKey(query, session);
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }

  /**
   * Provider-specific cache invalidation logic.
   * Returns the list of cache keys to invalidate based on mutations.
   * Default implementation invalidates all cache entries for this provider.
   */
  protected getInvalidationKeys(_mutation: M, _session: Session): string[] {
    // Default: invalidate all cache entries for this provider
    const providerName = this.constructor.name.toLowerCase();
    return [`${providerName}:*`];
  }

  /**
   * Generate a cache key for the given query and session.
   * Override this to provide custom cache key generation.
   */
  protected generateCacheKey(query: Q, session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id || 'anonymous';
    return `${providerName}:${userId}:${this.hashQuery(query)}`;
  }

  /**
   * Get the cache TTL for the given query.
   * Override this to provide custom TTL logic.
   */
  protected getCacheTTL(_query: Q): number {
    // Default: 5 minutes
    return 300;
  }

  /**
   * Hash a query object for use in cache keys.
   */
  protected hashQuery(query: Q): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
  }
}
