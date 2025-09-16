// OpenTelemetry auto-initialization based on standard environment variables
// See: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/

// Framework integration exports (internal use only)
export { createTRPCTracing } from './trpc-middleware';
export { createProviderInstrumentation } from './provider-instrumentation';

// Decorator for tracing functions
export { traced, TracedOptions } from './trace-decorator';
export { getTracer } from './tracer';
// Graceful shutdown for process termination
export { shutdownOtel } from './sdk';
