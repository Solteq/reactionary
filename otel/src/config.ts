import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { MetricReader, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';

// Internal config interface - not exported
interface OtelConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  traceEnabled: boolean;
  metricsEnabled: boolean;
  metricExportIntervalMillis: number;
}

// Detect if we're running in a browser environment
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof process === 'undefined';
}

// Parse config from standard OTEL environment variables
// https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
export function getConfigFromEnv(): OtelConfig {
  // In browser environments, return disabled config
  if (isBrowser()) {
    return {
      serviceName: 'browser-service',
      serviceVersion: undefined,
      environment: 'browser',
      otlpEndpoint: undefined,
      otlpHeaders: undefined,
      traceEnabled: false,
      metricsEnabled: false,
      metricExportIntervalMillis: 60000,
    };
  }

  // Determine exporter type from standard OTEL vars
  const tracesExporter = process.env['OTEL_TRACES_EXPORTER'] || 'console';
  const metricsExporter = process.env['OTEL_METRICS_EXPORTER'] || 'console';
  
  return {
    serviceName: process.env['OTEL_SERVICE_NAME'] || 'unknown_service',
    serviceVersion: process.env['OTEL_SERVICE_VERSION'],
    environment: process.env['DEPLOYMENT_ENVIRONMENT'] || process.env['NODE_ENV'] || 'development',
    otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    otlpHeaders: process.env['OTEL_EXPORTER_OTLP_HEADERS'] 
      ? parseHeaders(process.env['OTEL_EXPORTER_OTLP_HEADERS'])
      : undefined,
    traceEnabled: tracesExporter !== 'none',
    metricsEnabled: metricsExporter !== 'none',
    metricExportIntervalMillis: process.env['OTEL_METRIC_EXPORT_INTERVAL'] 
      ? parseInt(process.env['OTEL_METRIC_EXPORT_INTERVAL'], 10)
      : 60000, // Default 60 seconds per OTEL spec
  };
}

function parseHeaders(headerString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  headerString.split(',').forEach(header => {
    const [key, value] = header.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });
  return headers;
}

export function createTraceExporter(config: OtelConfig): SpanExporter | undefined {
  if (!config.traceEnabled) {
    return undefined;
  }

  const tracesExporter = process.env['OTEL_TRACES_EXPORTER'] || 'console';
  
  switch (tracesExporter) {
    case 'otlp':
    case 'otlp/http': {
      if (!config.otlpEndpoint) {
        console.warn('OTEL_EXPORTER_OTLP_ENDPOINT not set, falling back to console');
        return new ConsoleSpanExporter();
      }
      // Use standard endpoint resolution
      const tracesEndpoint = process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] || 
                            `${config.otlpEndpoint}/v1/traces`;
      return new OTLPTraceExporter({
        url: tracesEndpoint,
        headers: config.otlpHeaders,
      });
    }
    case 'console':
      return new ConsoleSpanExporter();
    case 'none':
    default:
      return undefined;
  }
}

export function createMetricReader(config: OtelConfig): MetricReader | undefined {
  if (!config.metricsEnabled) {
    return undefined;
  }

  const metricsExporter = process.env['OTEL_METRICS_EXPORTER'] || 'console';
  let exporter;
  
  switch (metricsExporter) {
    case 'otlp':
    case 'otlp/http': {
      if (!config.otlpEndpoint) {
        console.warn('OTEL_EXPORTER_OTLP_ENDPOINT not set, falling back to console');
        exporter = new ConsoleMetricExporter();
      } else {
        // Use standard endpoint resolution
        const metricsEndpoint = process.env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'] || 
                              `${config.otlpEndpoint}/v1/metrics`;
        exporter = new OTLPMetricExporter({
          url: metricsEndpoint,
          headers: config.otlpHeaders,
        });
      }
      break;
    }
    case 'console':
      exporter = new ConsoleMetricExporter();
      break;
    case 'none':
    default:
      return undefined;
  }

  return new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: config.metricExportIntervalMillis,
  });
}