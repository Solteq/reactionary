import type { BaseProvider } from '../providers/index.js';
import type { 
  Tracer, } from '@opentelemetry/api';
import { 
  trace, 
  SpanKind
} from '@opentelemetry/api';

const TRACER_NAME = '@reactionary';
const TRACER_VERSION = '0.0.1';

let globalTracer: Tracer | null = null;

export function getTracer(): Tracer {
  if (!globalTracer) {
    // Simply get the tracer from the API
    // If the SDK is not initialized by the host application,
    // this will return a ProxyTracer that produces NonRecordingSpans
    globalTracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);
  }
  return globalTracer;
}

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

          // TODO: Figure out what to do here, for nulls
          if (!result) {
            return result;
          }

          // TODO: Assert individual elements
          if (result instanceof Array) {
            return result;
          }
          
          return this.assert(result as any);
        }
      );
    };

    return descriptor;
  };
}
