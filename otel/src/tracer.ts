import type { 
  Tracer, 
  Span,
  Context,
  SpanOptions,
  Attributes} from '@opentelemetry/api';
import { 
  trace, 
  SpanStatusCode,
  context as otelContext
} from '@opentelemetry/api';

const TRACER_NAME = '@reactionary/otel';
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

export function startSpan(
  name: string,
  options?: SpanOptions,
  context?: Context
): Span {
  const tracer = getTracer();
  if (context) {
    return tracer.startActiveSpan(name, options || {}, context, (span) => span);
  }
  return tracer.startSpan(name, options);
}

export function withSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, options || {}, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export function setSpanAttributes(span: Span, attributes: Attributes): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      span.setAttribute(key, value);
    }
  });
}

export function createChildSpan(
  parentSpan: Span,
  name: string,
  options?: SpanOptions
): Span {
  const ctx = trace.setSpan(otelContext.active(), parentSpan);
  return getTracer().startSpan(name, options, ctx);
}

export { SpanKind, SpanStatusCode } from '@opentelemetry/api';