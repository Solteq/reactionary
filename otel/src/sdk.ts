import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { 
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { 
  getConfigFromEnv, 
  createTraceExporter,
  createMetricReader,
} from './config';

let sdk: NodeSDK | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Detect if we're running in a browser environment
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof process === 'undefined';
}

// Auto-initialize OTEL on first use with standard env vars
function ensureInitialized(): void {
  if (isInitialized || initializationPromise) {
    return;
  }

  // Skip initialization in browser environments
  if (isBrowser()) {
    isInitialized = true;
    return;
  }

  // Prevent multiple initialization attempts
  initializationPromise = Promise.resolve().then(() => {
    const config = getConfigFromEnv();
    
    // Only log if explicitly requested via debug env var
    if (process.env['OTEL_LOG_LEVEL'] === 'debug') {
      console.log('OpenTelemetry auto-initializing with config:', {
        serviceName: config.serviceName,
        environment: config.environment,
        tracesExporter: process.env['OTEL_TRACES_EXPORTER'] || 'console',
        metricsExporter: process.env['OTEL_METRICS_EXPORTER'] || 'console',
      });
    }

    const attributes: Record<string, string> = {
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    };
    
    if (config.serviceVersion) {
      attributes[SEMRESATTRS_SERVICE_VERSION] = config.serviceVersion;
    }
    if (config.environment) {
      attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = config.environment;
    }
    
    const customResource = resourceFromAttributes(attributes);
    const resource = defaultResource().merge(customResource);

    const traceExporter = createTraceExporter(config);
    const metricReader = createMetricReader(config);

    const instrumentations = [
      new HttpInstrumentation({
        requestHook: (span, request: unknown) => {
          const req = request as { headers?: Record<string, string | number> };
          if (req.headers) {
            span.setAttribute('http.request.body.size', req.headers['content-length'] || 0);
          }
        },
        responseHook: (span, response: unknown) => {
          const res = response as { headers?: Record<string, string | number> };
          if (res.headers) {
            span.setAttribute('http.response.body.size', res.headers['content-length'] || 0);
          }
        },
      }),
      new ExpressInstrumentation(),
    ];

    sdk = new NodeSDK({
      resource,
      spanProcessors: traceExporter ? [new BatchSpanProcessor(traceExporter)] : [],
      metricReader,
      instrumentations,
    });

    sdk.start();
    isInitialized = true;

    process.on('SIGTERM', async () => {
      try {
        await shutdownOtel();
        if (process.env['OTEL_LOG_LEVEL'] === 'debug') {
          console.log('OpenTelemetry terminated successfully');
        }
      } catch (error) {
        console.error('Error terminating OpenTelemetry', error);
      }
    });
  });
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    isInitialized = false;
  }
}

export function isOtelInitialized(): boolean {
  ensureInitialized();
  return isInitialized;
}