import { describe, expect, it } from 'vitest';
import { BaseProvider } from '../providers/base.provider.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { Cache } from '../cache/cache.interface.js';
import { Reactionary, type ReactionaryDecoratorOptions } from '../decorators/reactionary.decorator.js';
import { NoOpCache } from '../cache/noop-cache.js';
import { createInitialRequestContext } from '../initialization.js';

export function createTestableProvider(decoratorOptions: Partial<ReactionaryDecoratorOptions>) {
  class TestableProvider extends BaseProvider {
    constructor(public override cache: Cache, public override context: RequestContext) {
      super(cache, context);
    }

    @Reactionary(decoratorOptions)
    public async decoratedFunction() {
      return 'BASE';
    }

    public override generateCacheKeyForQuery(scope: string, query: object): string {
      return super.generateCacheKeyForQuery(scope, query);
    }

    public getResourceName(): string {
      return "TestableProvider";
    }
  }

  const cache = new NoOpCache();
  const context = createInitialRequestContext();

  return new TestableProvider(cache, context);
}

describe('@Reactionary decorator', () => {
  describe('Caching', () => {
    it('should get a NotFound for an unknown cart ID', async () => {
      const provider = createTestableProvider({});
      const result = await provider.decoratedFunction();

      expect(result).toBe(true);
    });
  });
});
