import { BaseProvider } from './base.provider';
import { BaseModel } from '../schemas/models/base.model';
import { BaseQuery } from '../schemas/queries/base.query';
import { BaseMutation } from '../schemas/mutations/base.mutation';
import { Session } from '../schemas/session.schema';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import * as crypto from 'crypto';

/**
 * Base provider with default caching implementation that other providers can extend
 */
export abstract class BaseCachedProvider<
  T extends BaseModel = BaseModel,
  Q extends BaseQuery = BaseQuery,
  M extends BaseMutation = BaseMutation
> extends BaseProvider<T, Q, M> {

  protected getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    // Check if caching should be enabled
    if (!this.shouldCache(session)) {
      return {
        key: '',
        cacheDurationInSeconds: 0,
        canCache: false
      };
    }
    
    // Generate cache key and TTL
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache: true
    };
  }

  /**
   * Override this method to provide provider-specific cache key generation
   */
  protected generateCacheKey(query: Q, session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id || 'anonymous';
    return `${providerName}:${userId}:${this.hashQuery(query)}`;
  }

  /**
   * Override this method to provide provider-specific invalidation logic
   */
  protected getInvalidationKeys(_mutation: M, _session: Session): string[] {
    // Default: invalidate all cache entries for this provider
    const providerName = this.constructor.name.toLowerCase();
    return [`${providerName}:*`];
  }

  /**
   * Override this method to provide provider-specific caching rules
   */
  protected shouldCache(_session: Session): boolean {
    // Global caching controls
    if (process.env['NODE_ENV'] === 'test' || process.env['DISABLE_CACHE'] === 'true') {
      return false;
    }
    
    // Check if Redis configuration is available
    return !!(process.env['UPSTASH_REDIS_REST_URL'] || process.env['REDIS_URL']);
  }

  /**
   * Override this method to provide provider-specific TTL logic
   */
  protected getCacheTTL(_query: Q): number {
    // Default: 5 minutes
    return 300;
  }

  protected hashQuery(query: Q): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
  }
}