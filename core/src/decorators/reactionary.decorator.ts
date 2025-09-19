import type { BaseProvider } from '../providers';
import { getTracer, SpanKind } from '@reactionary/otel';

/**
 * The options associated with annotating a provider function and marking
 * it as a reactionary entrypoint to be called
 */
export class ReactionaryDecoratorOptions {
  /**
   * Whether or not the query is eligible for caching. Queries that depend
   * heavily on personalization, for example, are likely to be a poor fit
   * for caching.
   */
  public cache = false;

  /**
   * Whether or not the cache entry should be variable based on the locale
   * of the context in which it is querried.
   */
  public localeDependentCaching = false;

  /**
   * Whether or not the cache entry should be variable based on the currency
   * of the context in which it is querried.
   */
  public currencyDependentCaching = false;

  /**
   * The number of seconds which a cache entry should be considered valid for the
   * given query.
   */
  public cacheTimeToLiveInSeconds = 60;

};

/**
 * Decorator for provider functions to provide functionality such as caching, tracing and type-checked
 * assertion through Zod. It should only be used with publically accessible queries or mutations on
 * providers.
 */
export function Reactionary(options: Partial<ReactionaryDecoratorOptions>) {
  return function (
    target: BaseProvider,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    const scope = `${target.constructor.name}.${propertyKey.toString()}`;
    const configuration = { ...new ReactionaryDecoratorOptions(), ...options };

    if (!original) {
      throw new Error(
        '@Reactionary decorator may only be applied to methods on classes extending BaseProvider.'
      );
    }

    descriptor.value = async function (this: BaseProvider, ...args: any[]) {
      const tracer = getTracer();

      return tracer.startActiveSpan(
        propertyKey.toString(),
        { kind: SpanKind.SERVER },
        async (span) => {
          const cacheKey = this.generateCacheKeyForQuery(scope, args[0]);

          const fromCache = await this.cache.get(cacheKey, this.schema);
          let result = fromCache;

          if (!result) {
            result = await original.apply(this, args);

            const dependencyIds = this.generateDependencyIdsForModel(result);

            this.cache.put(cacheKey, result, {
              ttlSeconds: configuration.cacheTimeToLiveInSeconds,
              dependencyIds: dependencyIds
            });
          }

          span.end();
          return this.assert(result as any);
        }
      );
    };

    return descriptor;
  };
}
