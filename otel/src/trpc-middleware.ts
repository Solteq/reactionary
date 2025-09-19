import { TRPCError } from '@trpc/server';
import type { 
  Span} from '@opentelemetry/api';
import {
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import { getTracer } from './tracer';
import { getMetrics } from './metrics';

export interface TRPCMiddlewareOptions {
  /** Whether to include input data in span attributes */
  includeInput?: boolean;
  /** Whether to include output data in span attributes */
  includeOutput?: boolean;
  /** Maximum string length for attributes */
  maxAttributeLength?: number;
}

const defaultOptions: TRPCMiddlewareOptions = {
  includeInput: true,
  includeOutput: false,
  maxAttributeLength: 1000,
};

export function createTRPCTracing(options: TRPCMiddlewareOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  const metrics = getMetrics();

  return ({ path, type, next, input, rawInput }: any) => {
    const pathStr = path || 'unknown';
    const tracer = getTracer();
    const spanName = `trpc.${type}.${pathStr}`;
    
    const startTime = Date.now();
    metrics.requestCounter.add(1, {
      'rpc.method': pathStr,
      'rpc.system': 'trpc',
      'rpc.service': type,
    });
    metrics.activeRequests.add(1);

    return tracer.startActiveSpan(
      spanName,
      {
        kind: type === 'mutation' ? SpanKind.CLIENT : SpanKind.SERVER,
        attributes: {
          'rpc.system': 'trpc',
          'rpc.method': pathStr,
          'rpc.service': type,
          'trpc.type': type,
          'trpc.path': pathStr,
        },
      },
      async (span: Span) => {
        try {
          if (opts.includeInput && (rawInput !== undefined || input !== undefined)) {
            const inputData = rawInput || input;
            const inputStr = truncateString(JSON.stringify(inputData), opts.maxAttributeLength || 1000);
            span.setAttribute('trpc.input', inputStr);
          }

          const result = await next();

          if (opts.includeOutput && result !== undefined) {
            const outputStr = truncateString(JSON.stringify(result), opts.maxAttributeLength || 1000);
            span.setAttribute('trpc.output', outputStr);
          }

          span.setStatus({ code: SpanStatusCode.OK });
          
          const duration = Date.now() - startTime;
          metrics.requestDuration.record(duration, {
            'rpc.method': pathStr,
            'rpc.system': 'trpc',
            'rpc.service': type,
            'status': 'success',
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorCode = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';
          
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          
          span.setAttribute('trpc.error.code', errorCode);
          span.setAttribute('trpc.error.message', errorMessage);
          
          if (error instanceof Error) {
            span.recordException(error);
          }

          const duration = Date.now() - startTime;
          metrics.requestDuration.record(duration, {
            'rpc.method': pathStr,
            'rpc.system': 'trpc',
            'rpc.service': type,
            'status': 'error',
            'error.code': errorCode,
          });
          
          metrics.errorCounter.add(1, {
            'rpc.method': pathStr,
            'rpc.system': 'trpc',
            'rpc.service': type,
            'error.code': errorCode,
          });

          throw error;
        } finally {
          span.end();
          metrics.activeRequests.add(-1);
        }
      }
    );
  };
};

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}