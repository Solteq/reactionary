import type { Counter, Gauge } from '@opentelemetry/api';
import { metrics, type Histogram, type UpDownCounter } from '@opentelemetry/api';

const METRICS_NAME = '@reactionary';
const TRACER_VERSION = '0.0.1';

export interface ReactionaryCacheMetrics {
  items: Gauge;
  hits: Counter;
  misses: Counter;
}

let globalCacheMetrics: ReactionaryCacheMetrics | null = null;
export function getReactionaryCacheMeter(): ReactionaryCacheMetrics {
  if (!globalCacheMetrics) {
    const meter = metrics.getMeter(METRICS_NAME, TRACER_VERSION);
    globalCacheMetrics = {
      items: meter.createGauge('reactionary_cache_items', {
        description: 'Tracks the number of items in the cache',
      }),
      hits: meter.createCounter('reactionary_cache_hits', {
        description: 'Counts the number of cache hits',
      }),
      misses: meter.createCounter('reactionary_cache_misses', {
        description: 'Counts the number of cache misses',
      }),
    };
  }
  return globalCacheMetrics;
}


export interface ReactionaryMetrics {
  requests: Counter;
  requestDuration: Histogram;
  requestInProgress: UpDownCounter;
}

let globalMetrics: ReactionaryMetrics | null = null;

export function getReactionaryMeter(): ReactionaryMetrics {
  if (!globalMetrics) {
    const meter = metrics.getMeter(METRICS_NAME, TRACER_VERSION);
    globalMetrics = {
      requests: meter.createCounter('reactionary_provider_requests', {
        description:
          'Counts the number of requests made to provider queries and mutations',
      }),
      requestDuration: meter.createHistogram(
        'reactionary_provider_request_duration',
        {
          description:
            'Records the duration of provider query and mutation requests',
          unit: 'ms',
        }
      ),
      requestInProgress: meter.createUpDownCounter(
        'reactionary_provider_requests_in_progress',
        {
          description:
            'Tracks the number of in-progress requests to provider queries and mutations',
        }
      ),
    };
  }
  return globalMetrics;
}
