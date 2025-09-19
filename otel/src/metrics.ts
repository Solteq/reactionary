import type { Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';

const METER_NAME = '@reactionary/otel';
const METER_VERSION = '0.0.1';

let globalMeter: Meter | null = null;

export function getMeter(): Meter {
  if (!globalMeter) {
    // Simply get the meter from the API
    // If the SDK is not initialized by the host application,
    // this will return a NoopMeter
    globalMeter = metrics.getMeter(METER_NAME, METER_VERSION);
  }
  return globalMeter;
}

export interface ReactMetrics {
  requestCounter: Counter;
  requestDuration: Histogram;
  activeRequests: UpDownCounter;
  errorCounter: Counter;
  providerCallCounter: Counter;
  providerCallDuration: Histogram;
  cacheHitCounter: Counter;
  cacheMissCounter: Counter;
}

let metricsInstance: ReactMetrics | null = null;

export function initializeMetrics(): ReactMetrics {
  if (metricsInstance) {
    return metricsInstance;
  }

  const meter = getMeter();

  metricsInstance = {
    requestCounter: meter.createCounter('reactionary.requests', {
      description: 'Total number of requests',
    }),
    requestDuration: meter.createHistogram('reactionary.request.duration', {
      description: 'Request duration in milliseconds',
      unit: 'ms',
    }),
    activeRequests: meter.createUpDownCounter('reactionary.requests.active', {
      description: 'Number of active requests',
    }),
    errorCounter: meter.createCounter('reactionary.errors', {
      description: 'Total number of errors',
    }),
    providerCallCounter: meter.createCounter('reactionary.provider.calls', {
      description: 'Total number of provider calls',
    }),
    providerCallDuration: meter.createHistogram('reactionary.provider.duration', {
      description: 'Provider call duration in milliseconds',
      unit: 'ms',
    }),
    cacheHitCounter: meter.createCounter('reactionary.cache.hits', {
      description: 'Total number of cache hits',
    }),
    cacheMissCounter: meter.createCounter('reactionary.cache.misses', {
      description: 'Total number of cache misses',
    }),
  };

  return metricsInstance;
}

export function getMetrics(): ReactMetrics {
  if (!metricsInstance) {
    return initializeMetrics();
  }
  return metricsInstance;
}