// OpenTelemetry instrumentation library
// This library provides instrumentation only - the host application
// is responsible for initializing the OpenTelemetry SDK

// Framework integration exports (internal use only)
export { createTRPCTracing } from './trpc-middleware';
export { createProviderInstrumentation } from './provider-instrumentation';

// Decorator for tracing functions
export { traced } from './trace-decorator';
export type { TracedOptions } from './trace-decorator';

// Utility functions for manual instrumentation
export { 
  getTracer, 
  startSpan, 
  withSpan, 
  setSpanAttributes, 
  createChildSpan,
  SpanKind,
  SpanStatusCode
} from './tracer';
