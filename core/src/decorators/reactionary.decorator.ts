import type { BaseProvider } from '../providers/index.js';
import type { Span, Tracer } from '@opentelemetry/api';
import { trace, SpanKind } from '@opentelemetry/api';
import type { z, ZodAny } from 'zod';

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

  /**
   * The schema for the input (query or mutation) type, for validation purposes
   */
  public inputSchema?: z.ZodType;

  /**
   * The schema for the primary output type, for validation purposes
   */
  public outputSchema?: z.ZodType;
}

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
      return traceSpan(scope, async () => {
        const input = validateInput(args[0], configuration.inputSchema);

        const cacheKey = this.generateCacheKeyForQuery(scope, input as any);
        const fromCache = await this.cache.get(cacheKey, options.inputSchema as any);
        let result = fromCache;

        if (!result) {
          result = await original.apply(this, [input]);

          const dependencyIds = this.generateDependencyIdsForModel(result);

          this.cache.put(cacheKey, result, {
            ttlSeconds: configuration.cacheTimeToLiveInSeconds,
            dependencyIds: dependencyIds,
          });
        }

        return validateOutput(result, configuration.outputSchema);
      });
    };

    return descriptor;
  };
}

/**
 * Utility function to handle input validation.
 */
export function validateInput(input: any, schema: z.ZodType | undefined) {
  if (!schema) {
    return input;
  }

  const parsed = schema.parse(input);

  return parsed;
}

/**
 * Utility function to handle output validation.
 */
export function validateOutput(output: any, schema: z.ZodType | undefined) {
  if (!schema) {
    return output;
  }

  const parsed = schema.parse(output);

  return parsed;
}

/**
 * Utility function to wrap entry / exit into decorated functions in a
 * traced span for OTEL handling.
 */
export async function traceSpan<T>(
  name: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const tracer: Tracer = getTracer();

  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn();
    } catch (err: unknown) {
      if (err instanceof Error) {
        span.recordException(err);
        span.setStatus({ code: 2, message: err.message });
      } else {
        span.recordException({ message: String(err) });
        span.setStatus({ code: 2, message: String(err) });
      }

      // TODO: Instead of re-throwing here, we might actually want to return a distinct error type
      // but I am unsure if that is really a task for the decorator (outside of input / output parsing)
      // it could perhaps always handle an unknown exception as a generic error type, for consolidation
      throw err;
    } finally {
      span.end();
    }
  });
}
