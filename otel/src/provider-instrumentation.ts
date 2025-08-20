import { Span, SpanKind } from '@opentelemetry/api';
import { withSpan, setSpanAttributes } from './tracer';
import { getMetrics } from './metrics';

export interface ProviderSpanOptions {
  providerName: string;
  operationType: 'query' | 'mutation';
  operationName?: string;
  attributes?: Record<string, unknown>;
}

export async function withProviderSpan<T>(
  options: ProviderSpanOptions,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const { providerName, operationType, operationName, attributes = {} } = options;
  const metrics = getMetrics();
  const spanName = `provider.${providerName}.${operationType}${operationName ? `.${operationName}` : ''}`;
  
  const startTime = Date.now();
  metrics.providerCallCounter.add(1, {
    'provider.name': providerName,
    'provider.operation.type': operationType,
    'provider.operation.name': operationName || 'unknown',
  });

  return withSpan(
    spanName,
    async (span) => {
      setSpanAttributes(span, {
        'provider.name': providerName,
        'provider.operation.type': operationType,
        'provider.operation.name': operationName,
        ...attributes,
      });

      // Span kind is set via options in withSpan

      try {
        const result = await fn(span);
        
        const duration = Date.now() - startTime;
        metrics.providerCallDuration.record(duration, {
          'provider.name': providerName,
          'provider.operation.type': operationType,
          'provider.operation.name': operationName || 'unknown',
          'status': 'success',
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        metrics.providerCallDuration.record(duration, {
          'provider.name': providerName,
          'provider.operation.type': operationType,
          'provider.operation.name': operationName || 'unknown',
          'status': 'error',
        });

        metrics.errorCounter.add(1, {
          'provider.name': providerName,
          'provider.operation.type': operationType,
          'provider.operation.name': operationName || 'unknown',
        });

        throw error;
      }
    },
    { kind: SpanKind.CLIENT }
  );
}

export function createProviderInstrumentation(providerName: string) {
  return {
    traceQuery: <T>(
      operationName: string,
      fn: (span: Span) => Promise<T>,
      attributes?: Record<string, unknown>
    ) => {
      return withProviderSpan(
        {
          providerName,
          operationType: 'query',
          operationName,
          attributes,
        },
        fn
      );
    },
    
    traceMutation: <T>(
      operationName: string,
      fn: (span: Span) => Promise<T>,
      attributes?: Record<string, unknown>
    ) => {
      return withProviderSpan(
        {
          providerName,
          operationType: 'mutation',
          operationName,
          attributes,
        },
        fn
      );
    },
  };
}