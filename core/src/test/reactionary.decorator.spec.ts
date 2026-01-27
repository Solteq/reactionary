import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseProvider } from '../providers/base.provider.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { Cache } from '../cache/cache.interface.js';
import {
  Reactionary,
  type ReactionaryDecoratorOptions,
} from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import { z } from 'zod';
import { success, MemoryCache, type Result } from '../index.js';
import { assert } from 'vitest';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { hrTimeToMilliseconds } from '@opentelemetry/core';

export function createTestableProvider(
  decoratorOptions: Partial<ReactionaryDecoratorOptions>,
  fn?: any
) {
  class TestableProvider extends BaseProvider {
    constructor(
      public override cache: Cache,
      public override context: RequestContext
    ) {
      super(cache, context);
    }

    @Reactionary({
      inputSchema: z.undefined(),
      outputSchema: z.string(),
      ...decoratorOptions,
    })
    public async decoratedFunction(
      ...args: unknown[]
    ): Promise<Result<unknown>> {
      if (fn) {
        return await fn(args);
      }

      return success('BASE');
    }

    public override generateCacheKeyForQuery(
      scope: string,
      query: object
    ): string {
      return super.generateCacheKeyForQuery(scope, query);
    }

    public getResourceName(): string {
      return 'TestableProvider';
    }
  }

  const cache = new MemoryCache();
  const context = createInitialRequestContext();

  return new TestableProvider(cache, context);
}

describe('@Reactionary decorator', () => {
  describe('Input validation', () => {
    it('should reject invalid input with a failure', async () => {
      const provider = createTestableProvider({
        cache: false,
        inputSchema: z.string(),
      });

      const result = await provider.decoratedFunction(42);

      expect(result.success).toBe(false);
    });

    it('should allow valid input through with a success', async () => {
      const provider = createTestableProvider({
        cache: false,
        inputSchema: z.string(),
      });

      const result = await provider.decoratedFunction('42');

      expect(result.success).toBe(true);
    });
  });

  describe('Output validation', () => {
    it('should reject invalid output with a failure', async () => {
      const provider = createTestableProvider(
        {
          cache: false,
          outputSchema: z.string(),
        },
        function () {
          return success(42);
        }
      );

      const result = await provider.decoratedFunction();

      expect(result.success).toBe(false);
    });

    it('should allow valid output with a success', async () => {
      const provider = createTestableProvider(
        {
          cache: false,
          outputSchema: z.string(),
        },
        function () {
          return success('42');
        }
      );

      const result = await provider.decoratedFunction();

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('will wrap errors thrown by the provider in a GenericError', async () => {
      const provider = createTestableProvider({}, function () {
        throw new Error('42');
      });

      const result = await provider.decoratedFunction();

      if (result.success) {
        assert.fail();
      }

      expect(result.error.type).toBe('Generic');
    });
  });

  describe('Tracing', () => {
    let exporter: InMemorySpanExporter;
    let provider: NodeTracerProvider;

    beforeEach(() => {
      exporter = new InMemorySpanExporter();
      provider = new NodeTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });

      provider.register();
    });

    afterEach(() => {
      exporter.reset();
      trace.disable();
    });

    it('records a timed span for entering the decorated function', async () => {
      const provider = createTestableProvider({
        cache: false,
      }, async function() { 
        await new Promise(resolve => setTimeout(resolve, 200));

        return "42";
      });
      const result = await provider.decoratedFunction();
      const spans = exporter.getFinishedSpans();

      expect(spans.length).toBe(1);

      const span = spans[0];
      const duration = hrTimeToMilliseconds(span.duration);
      const name = span.name;
      const status = span.status;

      console.log('unset expected: ', status);

      expect(name).toBe('TestableProvider.decoratedFunction');
      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThanOrEqual(300);
      expect(status.code).toBe(SpanStatusCode.UNSET);
    });

    it('records exceptions as events and marks the span as an error', async () => {
      const provider = createTestableProvider({
        cache: false,
      }, async function() { 
        throw new Error('42');
      });

      const result = await provider.decoratedFunction();
      const spans = exporter.getFinishedSpans();

      expect(spans.length).toBe(1);

      const span = spans[0];
      const name = span.name;
      const status = span.status;

      expect(name).toBe('TestableProvider.decoratedFunction');
      expect(status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe('Caching', () => {
    it('should not cache repeat lookups if the decorator is set to uncached', async () => {
      const provider = createTestableProvider({
        cache: false,
      });
      const result = await provider.decoratedFunction();

      if (!result.success) {
        assert.fail();
      }

      expect(result.meta.cache.hit).toBe(false);

      const secondResult = await provider.decoratedFunction();

      if (!secondResult.success) {
        assert.fail();
      }

      expect(secondResult.meta.cache.hit).toBe(false);
    });

    it('should cache repeat lookups if the decorator is set to cached', async () => {
      const provider = createTestableProvider({
        cache: true,
      });
      const result = await provider.decoratedFunction();

      if (!result.success) {
        assert.fail();
      }

      expect(result.meta.cache.hit).toBe(false);

      const secondResult = await provider.decoratedFunction();

      if (!secondResult.success) {
        assert.fail();
      }

      expect(secondResult.meta.cache.hit).toBe(true);
    });
  });
});
