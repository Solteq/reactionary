import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { getTracer } from './tracer';

/**
 * Options for the @traced decorator
 */
export interface TracedOptions {
  /** Whether to capture function arguments as span attributes (default: true) */
  captureArgs?: boolean;
  /** Whether to capture the return value as a span attribute (default: true) */
  captureResult?: boolean;
  /** Custom span name to use instead of the function name */
  spanName?: string;
  /** OpenTelemetry SpanKind (default: INTERNAL) */
  spanKind?: SpanKind;
}

/**
 * Safely serializes a value for use as a span attribute
 * Handles circular references and large objects
 */
function safeSerialize(value: unknown, maxDepth = 3, currentDepth = 0): string {
  if (currentDepth >= maxDepth) {
    return '[Max depth reached]';
  }

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string' || type === 'number' || type === 'boolean') {
    return String(value);
  }

  if (type === 'function') {
    return `[Function: ${(value as { name?: string }).name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return `[Error: ${value.message}]`;
  }

  if (Array.isArray(value)) {
    if (value.length > 10) {
      return `[Array(${value.length})]`;
    }
    try {
      return JSON.stringify(value.map(item =>
        safeSerialize(item, maxDepth, currentDepth + 1)
      ));
    } catch {
      return '[Array - circular reference]';
    }
  }

  if (type === 'object') {
    try {
      const keys = Object.keys(value as object);
      if (keys.length > 20) {
        return `[Object with ${keys.length} keys]`;
      }
      const simplified: Record<string, unknown> = {};
      for (const key of keys.slice(0, 10)) {
        simplified[key] = safeSerialize(
          (value as Record<string, unknown>)[key],
          maxDepth,
          currentDepth + 1
        );
      }
      return JSON.stringify(simplified);
    } catch {
      return '[Object - circular reference]';
    }
  }

  return String(value);
}

/**
 * TypeScript decorator for tracing function execution
 * Automatically creates OpenTelemetry spans for decorated methods
 * Uses Stage 2 (legacy) decorator syntax
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @traced()
 *   async fetchData(id: string): Promise<Data> {
 *     // method implementation
 *   }
 *
 *   @traced({ spanName: 'custom-operation', captureResult: false })
 *   processData(data: Data): void {
 *     // method implementation
 *   }
 * }
 * ```
 */
export function traced(options: TracedOptions = {}): MethodDecorator {
  const {
    captureArgs = false,
    captureResult = false,
    spanName,
    spanKind = SpanKind.INTERNAL
  } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    
    descriptor.value = createTracedMethod(originalMethod, methodName, {
      captureArgs,
      captureResult,
      spanName,
      spanKind
    });
    
    return descriptor;
  };
}

function createTracedMethod(
  originalMethod: (...args: any[]) => any,
  methodName: string,
  options: {
    captureArgs: boolean;
    captureResult: boolean;
    spanName?: string;
    spanKind: SpanKind;
  }
): any {
  const { captureArgs, captureResult, spanName, spanKind } = options;
  
  function tracedMethod(this: any, ...args: any[]): any {
    const tracer = getTracer();
    const className = this?.constructor?.name || 'Unknown';
    const effectiveSpanName = spanName || `${className}.${methodName}`;

    // Use startActiveSpan to ensure proper context propagation
    return tracer.startActiveSpan(effectiveSpanName, {
      kind: spanKind,
      attributes: {
        'function.name': methodName,
        'function.class': className,
      }
    }, (span) => {
      // Capture arguments if enabled
      if (captureArgs && args.length > 0) {
        args.forEach((arg, index) => {
          try {
            span.setAttribute(`function.args.${index}`, safeSerialize(arg));
          } catch {
            span.setAttribute(`function.args.${index}`, '[Serialization error]');
          }
        });
        span.setAttribute('function.args.count', args.length);
      }

      // Helper function to set span attributes and status
      const setSpanResult = (result: unknown, isError = false) => {
        if (!isError && captureResult && result !== undefined) {
          try {
            span.setAttribute('function.result', safeSerialize(result));
          } catch {
            span.setAttribute('function.result', '[Serialization error]');
          }
        }
        
        if (isError) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: result instanceof Error ? result.message : String(result)
          });
          if (result instanceof Error) {
            span.recordException(result);
          }
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        
        span.end();
      };

      try {
        const result = originalMethod.apply(this, args);
        
        // Handle async functions - await them to keep span open
        if (result instanceof Promise) {
          try {
            return result.then(value => {
              setSpanResult(value);
              return value;
            });
          } catch (error) {
            setSpanResult(error, true);
            throw error;
          }
        }
        
        // Handle sync functions
        setSpanResult(result);
        return result;
      } catch (error) {
        setSpanResult(error, true);
        throw error;
      }
    });
  }

  // Preserve the original function's name and properties
  Object.defineProperty(tracedMethod, 'name', {
    value: methodName,
    configurable: true
  });

  return tracedMethod;
}
