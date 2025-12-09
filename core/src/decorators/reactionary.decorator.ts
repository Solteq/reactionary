import type { Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { z } from 'zod';
import type { BaseProvider } from '../providers/index.js';
import { getReactionaryMeter } from '../metrics/metrics.js';
import { error, success, type Result } from '../schemas/result.js';
import type { InvalidInputError, InvalidOutputError, GenericError} from '../schemas/index.js';

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
    const meter = getReactionaryMeter();
    const attributes = {
      'labels.scope': scope,
    };
    const startTime = performance.now();
    let status = 'ok';
    let cacheStatus = 'miss';

    if (!original) {
      throw new Error(
        '@Reactionary decorator may only be applied to methods on classes extending BaseProvider.'
      );
    }

    descriptor.value = async function (this: BaseProvider, ...args: any[]) {
      return traceSpan(scope, async () => {
        meter.requestInProgress.add(1, attributes);
        try {
          const input = validateInput(args[0], configuration.inputSchema);

          if (!input.success) {
            return input;
          }

          const cacheKey = this.generateCacheKeyForQuery(scope, input.value);
          const fromCache = await this.cache.get(
            cacheKey,
            options.inputSchema as any
          );

          let result;
          if (!fromCache) {
            result = await original.apply(this, [input.value]);
            
            const r = result as Result<unknown>;

            if (r.success) {
              const dependencyIds = this.generateDependencyIdsForModel(r.value);

              this.cache.put(cacheKey, r.value, {
                ttlSeconds: configuration.cacheTimeToLiveInSeconds,
                dependencyIds: dependencyIds,
              });
            }
          } else {
            result = success(fromCache);
            cacheStatus = 'hit';
          }

          // TODO: Update the below after fixing the method signature.
          // That is, making the decorator only applicable to methods with
          // a signature returning a result.
          const validatedResult = validateOutput(result as any, configuration.outputSchema);

          if (validatedResult.success) {
            validatedResult.meta.cache.hit = !!fromCache;
            validatedResult.meta.cache.key = cacheKey;
          }

          return result;
        } catch (err) {
          console.error(err);

          status = 'error';
          
          const result = error<GenericError>({
            type: 'Generic',
            message: 'REDACTED'
          });

          return result;
        } finally {
          const duration = performance.now() - startTime;
          const finalAttributes = {
            ...attributes,
            'labels.status': status,
            'labels.cache_status': cacheStatus,
          };
          meter.requestInProgress.add(-1, finalAttributes);
          meter.requests.add(1, finalAttributes);
          meter.requestDuration.record(duration, finalAttributes);
        }
      });
    };

    return descriptor;
  };
}

/**
 * Utility function to handle input validation.
 */
export function validateInput<T>(
  input: T,
  schema: z.ZodType | undefined
): Result<T> {
  if (!schema) {
    return success(input);
  }

  let validated: Result<T> = success(input);
  const parse = schema.safeParse(input);

  if (!parse.success) {
    validated = error<InvalidInputError>({
      type: 'InvalidInput',
      error: parse.error
    })
  }

  return validated;
}

/**
 * Utility function to handle output validation.
 */
export function validateOutput(
  output: Result<unknown>,
  schema: z.ZodType | undefined
): Result<unknown> {
  if (!schema) {
    return output;
  }

  let validated = output;
  if (output.success) {
    const parse = schema.safeParse(output.value);

    if (!parse.success) {
      validated = error<InvalidOutputError>({
        type: 'InvalidOutput',
        error: parse.error
      })
    }
  }

  return validated;
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
