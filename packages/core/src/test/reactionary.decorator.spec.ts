import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseCapability,
  getReactionaryEntrypoints,
} from '../capabilities/base.capability.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { Cache } from '../cache/cache.interface.js';
import {
  Reactionary,
  type ReactionaryDecoratorOptions,
} from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import * as z from 'zod';
import { error, success, MemoryCache, type GenericError, type Result } from '../index.js';
import { assert } from 'vitest';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { hrTimeToMilliseconds } from '@opentelemetry/core';

export function createTestableCapability(
  decoratorOptions: Partial<ReactionaryDecoratorOptions>,
  fn?: any
) {
  class TestableCapability extends BaseCapability {
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
      query: object,
      locale: string,
      currency: string,
    ): string {
      return super.generateCacheKeyForQuery(scope, query, locale, currency);
    }

    public getResourceName(): string {
      return 'TestableCapability';
    }
  }

  const cache = new MemoryCache();
  const context = createInitialRequestContext();

  return new TestableCapability(cache, context);
}

describe('@Reactionary decorator', () => {
  describe('Entrypoint metadata', () => {
    it('exposes runtime metadata for decorated methods', () => {
      const inputSchema = z.object({ value: z.string() });
      const outputSchema = z.object({ result: z.string() });
      const capability = createTestableCapability({
        cache: true,
        inputSchema,
        outputSchema,
        title: 'Decorated function',
        description: 'A decorated function exposed as metadata',
      });

      const entrypoints = getReactionaryEntrypoints(capability);

      expect(entrypoints).toHaveLength(1);
      expect(entrypoints[0]).toMatchObject({
        capabilityName: 'TestableCapability',
        methodName: 'decoratedFunction',
        title: 'Decorated function',
        description: 'A decorated function exposed as metadata',
        cache: true,
      });
      expect(entrypoints[0].inputSchema).toBe(inputSchema);
      expect(entrypoints[0].outputSchema).toBe(outputSchema);
    });

    it('prefers redecorated subclass method metadata over base metadata', () => {
      const baseInputSchema = z.object({ base: z.string() });
      const subclassInputSchema = z.object({ subclass: z.string() });
      const baseOutputSchema = z.object({ baseResult: z.string() });
      const subclassOutputSchema = z.object({ subclassResult: z.string() });

      class BaseDecoratedCapability extends BaseCapability {
        @Reactionary({
          inputSchema: baseInputSchema,
          outputSchema: baseOutputSchema,
        })
        public async decoratedFunction(): Promise<Result<unknown>> {
          return success({ baseResult: 'base' });
        }

        protected getResourceName(): string {
          return 'redecorated-capability';
        }
      }

      class SubclassDecoratedCapability extends BaseDecoratedCapability {
        @Reactionary({
          inputSchema: subclassInputSchema,
          outputSchema: subclassOutputSchema,
        })
        public override async decoratedFunction(): Promise<Result<unknown>> {
          return success({ subclassResult: 'subclass' });
        }
      }

      const capability = new SubclassDecoratedCapability(
        new MemoryCache(),
        createInitialRequestContext(),
      );

      const entrypoints = getReactionaryEntrypoints(capability);

      expect(entrypoints).toHaveLength(1);
      expect(entrypoints[0].inputSchema).toBe(subclassInputSchema);
      expect(entrypoints[0].outputSchema).toBe(subclassOutputSchema);
    });
  });

  describe('Input validation', () => {
    it('should reject invalid input with a failure', async () => {
      const capability = createTestableCapability({
        cache: false,
        inputSchema: z.string(),
      });

      const result = await capability.decoratedFunction(42);

      expect(result.success).toBe(false);
    });

    it('should allow valid input through with a success', async () => {
      const capability = createTestableCapability({
        cache: false,
        inputSchema: z.string(),
      });

      const result = await capability.decoratedFunction('42');

      expect(result.success).toBe(true);
    });
  });

  describe('Output validation', () => {
    it('should reject invalid output with a failure', async () => {
      const capability = createTestableCapability(
        {
          cache: false,
          outputSchema: z.string(),
        },
        function () {
          return success(42);
        }
      );

      const result = await capability.decoratedFunction();

      expect(result.success).toBe(false);
    });

    it('should allow valid output with a success', async () => {
      const capability = createTestableCapability(
        {
          cache: false,
          outputSchema: z.string(),
        },
        function () {
          return success('42');
        }
      );

      const result = await capability.decoratedFunction();

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('will wrap errors thrown by the provider in a GenericError', async () => {
      const capability = createTestableCapability({}, function () {
        throw new Error('42');
      });

      const result = await capability.decoratedFunction();

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
      const capability = createTestableCapability({
        cache: false,
      }, async function() { 
        await new Promise(resolve => setTimeout(resolve, 200));

        return "42";
      });
      const result = await capability.decoratedFunction();
      const spans = exporter.getFinishedSpans();

      expect(spans.length).toBe(1);

      const span = spans[0];
      const duration = hrTimeToMilliseconds(span.duration);
      const name = span.name;
      const status = span.status;

      console.log('unset expected: ', status);

      expect(name).toBe('TestableCapability.decoratedFunction');
      expect(duration).toBeGreaterThan(150);
      expect(duration).toBeLessThanOrEqual(300);
      expect(status.code).toBe(SpanStatusCode.UNSET);
    });

    it('records exceptions as events and marks the span as an error', async () => {
      const capability = createTestableCapability({
        cache: false,
      }, async function() { 
        throw new Error('42');
      });

      const result = await capability.decoratedFunction();
      const spans = exporter.getFinishedSpans();

      expect(spans.length).toBe(1);

      const span = spans[0];
      const name = span.name;
      const status = span.status;

      expect(name).toBe('TestableCapability.decoratedFunction');
      expect(status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe('Caching', () => {
    it('should not cache repeat lookups if the decorator is set to uncached', async () => {
      const capability = createTestableCapability({
        cache: false,
      });
      const result = await capability.decoratedFunction();

      if (!result.success) {
        assert.fail();
      }

      expect(result.meta.cache.hit).toBe(false);

      const secondResult = await capability.decoratedFunction();

      if (!secondResult.success) {
        assert.fail();
      }

      expect(secondResult.meta.cache.hit).toBe(false);
    });

    it('should cache repeat lookups if the decorator is set to cached', async () => {
      const capability = createTestableCapability({
        cache: true,
      });
      const result = await capability.decoratedFunction();

      if (!result.success) {
        assert.fail();
      }

      expect(result.meta.cache.hit).toBe(false);

      const secondResult = await capability.decoratedFunction();

      if (!secondResult.success) {
        assert.fail();
      }

      expect(secondResult.meta.cache.hit).toBe(true);
    });

    describe('Concurrent calls', () => {
      const OutputSchema = z.object({ id: z.string(), tags: z.array(z.string()) });
      const pause = () => new Promise((resolve) => setTimeout(resolve, 10));

      class CountingCapability extends BaseCapability {
        public calls = 0;
        public answer: () => Result<unknown> = () => success({ id: 'a', tags: ['x'] });

        @Reactionary({
          inputSchema: z.object({ id: z.string() }),
          outputSchema: OutputSchema,
          cache: true,
        })
        public async cached(payload: { id: string }): Promise<Result<unknown>> {
          this.calls += 1;
          await pause();
          const answer = this.answer();
          return answer.success ? success({ id: payload.id, tags: ['x'] }) : answer;
        }

        @Reactionary({
          inputSchema: z.object({ id: z.string() }),
          outputSchema: OutputSchema,
          cache: false,
        })
        public async uncached(payload: { id: string }): Promise<Result<unknown>> {
          this.calls += 1;
          await pause();
          return success({ id: payload.id, tags: ['x'] });
        }

        public getResourceName(): string {
          return 'CountingCapability';
        }
      }

      const setup = () => {
        const cache = new MemoryCache();
        const capability = new CountingCapability(cache, createInitialRequestContext());
        return { cache, capability };
      };
      const six = [1, 2, 3, 4, 5, 6];

      it('runs identical calls that are running at the same time once, and reads and writes the cache once', async () => {
        const { cache, capability } = setup();
        const get = vi.spyOn(cache, 'get');
        const put = vi.spyOn(cache, 'put');

        const results = await Promise.all(six.map(() => capability.cached({ id: 'a' })));

        expect(capability.calls).toBe(1);
        expect(get).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledTimes(1);
        for (const result of results) {
          if (!result.success) {
            assert.fail();
          }
          expect(result.value).toEqual({ id: 'a', tags: ['x'] });
        }
      });

      it('gives every caller its own copy of the answer', async () => {
        const { capability } = setup();

        const [first, second] = await Promise.all([capability.cached({ id: 'a' }), capability.cached({ id: 'a' })]);

        if (!first.success || !second.success) {
          assert.fail();
        }
        (first.value as { tags: string[] }).tags.push('changed');
        expect((second.value as { tags: string[] }).tags).toEqual(['x']);
      });

      it('does not join calls with another payload', async () => {
        const { capability } = setup();

        await Promise.all([capability.cached({ id: 'a' }), capability.cached({ id: 'b' })]);

        expect(capability.calls).toBe(2);
      });

      it('does not join calls of another request, also when they share the cache', async () => {
        const cache = new MemoryCache();
        const one = new CountingCapability(cache, createInitialRequestContext());
        const other = new CountingCapability(cache, createInitialRequestContext());

        await Promise.all([one.cached({ id: 'a' }), other.cached({ id: 'a' })]);

        expect(one.calls + other.calls).toBe(2);
      });

      it('joins calls through different capability instances of the same request', async () => {
        const cache = new MemoryCache();
        const context = createInitialRequestContext();
        const one = new CountingCapability(cache, context);
        const other = new CountingCapability(cache, context);

        await Promise.all([one.cached({ id: 'a' }), other.cached({ id: 'a' })]);

        expect(one.calls + other.calls).toBe(1);
      });

      it('does not join calls of a method that is not cached', async () => {
        const { capability } = setup();

        await Promise.all(six.map(() => capability.uncached({ id: 'a' })));

        expect(capability.calls).toBe(6);
      });

      it('serves a call that comes after the first has finished from the cache', async () => {
        const { capability } = setup();

        await capability.cached({ id: 'a' });
        const second = await capability.cached({ id: 'a' });

        if (!second.success) {
          assert.fail();
        }
        expect(capability.calls).toBe(1);
        expect(second.meta.cache.hit).toBe(true);
      });

      it('gives a failed result to every joined call and asks again for the next one', async () => {
        const { capability } = setup();
        capability.answer = () => error<GenericError>({ type: 'Generic', message: 'down' });

        const results = await Promise.all(six.map(() => capability.cached({ id: 'a' })));

        expect(capability.calls).toBe(1);
        expect(results.every((result) => !result.success)).toBe(true);

        capability.answer = () => success({ id: 'a', tags: ['x'] });
        const next = await capability.cached({ id: 'a' });

        expect(capability.calls).toBe(2);
        expect(next.success).toBe(true);
      });

      it('gives every joined call a generic error when the method throws, and asks again for the next one', async () => {
        const { capability } = setup();
        capability.answer = () => {
          throw new Error('boom');
        };

        const results = await Promise.all([capability.cached({ id: 'a' }), capability.cached({ id: 'a' })]);

        expect(capability.calls).toBe(1);
        for (const result of results) {
          if (result.success) {
            assert.fail();
          }
          expect(result.error.type).toBe('Generic');
        }

        capability.answer = () => success({ id: 'a', tags: ['x'] });
        expect((await capability.cached({ id: 'a' })).success).toBe(true);
        expect(capability.calls).toBe(2);
      });
    });

    it('should return the result and not leak a rejection when writing to the cache fails', async () => {
      class FailingWriteCache extends MemoryCache {
        public override async put(): Promise<void> {
          throw new Error('Redis is down');
        }
      }

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);

      try {
        const capability = createTestableCapability({
          cache: true,
        });
        capability.cache = new FailingWriteCache();

        const result = await capability.decoratedFunction();

        // Give a stray rejection the chance to surface.
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(result.success).toBe(true);
        expect(unhandled).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        process.off('unhandledRejection', onUnhandled);
        warn.mockRestore();
      }
    });

    it('should treat a failing cache read as a miss and fall through to the provider', async () => {
      class FailingReadCache extends MemoryCache {
        public override async get(): Promise<never> {
          throw new Error('Redis is down');
        }
      }

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const capability = createTestableCapability({
          cache: true,
        });
        capability.cache = new FailingReadCache();

        const result = await capability.decoratedFunction();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toBe('BASE');
          expect(result.meta.cache.hit).toBe(false);
        }
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should survive a cache that throws synchronously', async () => {
      class ThrowingCache extends MemoryCache {
        public override get(): Promise<never> {
          throw new Error('not even a promise');
        }

        public override put(): Promise<void> {
          throw new Error('not even a promise');
        }
      }

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const capability = createTestableCapability({
          cache: true,
        });
        capability.cache = new ThrowingCache();

        const result = await capability.decoratedFunction();

        // Give a stray rejection the chance to surface.
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(result.success).toBe(true);
        // The failing read is logged, the failing write falls in the same interval.
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should log a failing cache once per interval rather than once per call', async () => {
      class FailingCache extends MemoryCache {
        public override async get(): Promise<never> {
          throw new Error('Redis is down');
        }
      }

      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const capability = createTestableCapability({
          cache: true,
        });
        capability.cache = new FailingCache();

        await capability.decoratedFunction();
        await capability.decoratedFunction();
        await capability.decoratedFunction();
        expect(warn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(61_000);

        await capability.decoratedFunction();
        expect(warn).toHaveBeenCalledTimes(2);
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });
  });
});
