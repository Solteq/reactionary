// SDK functions - auto-initialization handled internally
export { isOtelInitialized, shutdownOtel } from './sdk';

// Tracing utilities
export * from './tracer';
export * from './metrics';
export * from './trpc-middleware';
export * from './provider-instrumentation';

// Re-export common OTEL types
export { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Tracer, SpanOptions, Attributes } from '@opentelemetry/api';