import {
  metrics,
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Histogram,
  type Span,
  type UpDownCounter,
} from '@opentelemetry/api';

const METER_NAME = '@reactionary';
const METER_VERSION = '0.0.1';

export interface ReactionaryProtocolMetrics {
  requests: Counter;
  requestDuration: Histogram;
  requestsInProgress: UpDownCounter;
}

let globalProtocolMetrics: ReactionaryProtocolMetrics | null = null;

export function getReactionaryProtocolMeter(): ReactionaryProtocolMetrics {
  if (!globalProtocolMetrics) {
    const meter = metrics.getMeter(METER_NAME, METER_VERSION);
    globalProtocolMetrics = {
      requests: meter.createCounter('reactionary_protocol_requests', {
        description:
          'Counts the number of protocol invocations (UCP, ACP, MCP) served by Reactionary protocol servers',
      }),
      requestDuration: meter.createHistogram(
        'reactionary_protocol_request_duration',
        {
          description:
            'Records the duration of protocol invocations (UCP, ACP, MCP) served by Reactionary protocol servers',
          unit: 'ms',
        },
      ),
      requestsInProgress: meter.createUpDownCounter(
        'reactionary_protocol_requests_in_progress',
        {
          description:
            'Tracks the number of in-progress protocol invocations (UCP, ACP, MCP)',
        },
      ),
    };
  }

  return globalProtocolMetrics;
}

export interface ReactionaryProtocolInvocation {
  protocol: 'ucp' | 'acp' | 'mcp';
  operation: string;
  attributes?: Attributes;
}

/**
 * Wraps a single protocol invocation (an inbound UCP/ACP HTTP request or an
 * MCP tool call) in an OpenTelemetry span and records request count,
 * duration, and in-progress metrics. `getResultAttributes` may add result
 * attributes such as the HTTP status code and override `labels.status`.
 */
export async function traceProtocolInvocation<T>(
  invocation: ReactionaryProtocolInvocation,
  fn: (span: Span) => Promise<T>,
  getResultAttributes?: (result: T) => Attributes,
): Promise<T> {
  const meter = getReactionaryProtocolMeter();
  const tracer = trace.getTracer(METER_NAME, METER_VERSION);
  const baseAttributes: Attributes = {
    'labels.protocol': invocation.protocol,
    'labels.operation': invocation.operation,
    ...invocation.attributes,
  };
  const startTime = performance.now();
  meter.requestsInProgress.add(1, baseAttributes);

  return tracer.startActiveSpan(
    `${invocation.protocol.toUpperCase()} ${invocation.operation}`,
    { attributes: baseAttributes },
    async (span) => {
      let resultAttributes: Attributes = { 'labels.status': 'success' };

      try {
        const result = await fn(span);

        if (getResultAttributes) {
          resultAttributes = { ...resultAttributes, ...getResultAttributes(result) };
        }

        if (resultAttributes['labels.status'] === 'error') {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }

        span.setAttributes(resultAttributes);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        resultAttributes = { 'labels.status': 'exception' };
        span.recordException(err instanceof Error ? err : { message });
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw err;
      } finally {
        const finalAttributes = { ...baseAttributes, ...resultAttributes };
        meter.requestsInProgress.add(-1, baseAttributes);
        meter.requests.add(1, finalAttributes);
        meter.requestDuration.record(performance.now() - startTime, finalAttributes);
        span.end();
      }
    },
  );
}

export function getHttpProtocolResultAttributes(response: Response): Attributes {
  return {
    'labels.status': response.status >= 500 ? 'error' : 'success',
    'http.response.status_code': response.status,
  };
}
