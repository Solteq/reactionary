// OpenTelemetry auto-initialization based on standard environment variables
// See: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/

// Framework integration exports (internal use only)
export { createTRPCTracing } from './trpc-middleware';
export { createProviderInstrumentation } from './provider-instrumentation';

// Graceful shutdown for process termination
export { shutdownOtel } from './sdk';