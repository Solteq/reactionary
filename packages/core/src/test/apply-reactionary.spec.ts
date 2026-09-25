import { assert, describe, expect, it } from 'vitest';
import * as z from 'zod';
import { BaseCapability } from '../capabilities/base.capability.js';
import {
  applyReactionary,
  Reactionary,
} from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import { MemoryCache, success, type Result } from '../index.js';

const QuerySchema = z.object({ id: z.string() });
type Query = z.infer<typeof QuerySchema>;

class BaseTestCapability extends BaseCapability {
  @Reactionary({ inputSchema: QuerySchema, outputSchema: z.string() })
  public async getById(query: Query): Promise<Result<string>> {
    return success(`base-${query.id}`);
  }

  public helper(): string {
    return 'not-an-operation';
  }

  protected getResourceName(): string {
    return 'BaseTestCapability';
  }
}

/**
 * Creates a fresh subclass per test, since applying the decorator mutates
 * the subclass prototype.
 */
function createOverridingCapabilityClass() {
  return class OverridingTestCapability extends BaseTestCapability {
    public override async getById(query: Query): Promise<Result<string>> {
      if (query.id === 'throw') {
        throw new Error('boom');
      }
      return success(`override-${query.id}`);
    }
  };
}

function instantiate<T>(
  Capability: new (...args: ConstructorParameters<typeof BaseCapability>) => T
): T {
  return new Capability(new MemoryCache(), createInitialRequestContext());
}

const invalidQuery = { id: 42 } as unknown as Query;

describe('applyReactionary', () => {
  describe('without applyReactionary, an overriding method loses the decorator', () => {
    it('does not reject invalid input', async () => {
      const capability = instantiate(createOverridingCapabilityClass());

      const result = await capability.getById(invalidQuery);

      expect(result.success).toBe(true);
    });

    it('lets thrown errors propagate', async () => {
      const capability = instantiate(createOverridingCapabilityClass());

      await expect(capability.getById({ id: 'throw' })).rejects.toThrow('boom');
    });
  });

  describe('with applyReactionary on the overriding method', () => {
    it('rejects invalid input with an InvalidInput error result', async () => {
      const Capability = createOverridingCapabilityClass();
      applyReactionary(Capability, 'getById', {
        inputSchema: QuerySchema,
        outputSchema: z.string(),
      });
      const capability = instantiate(Capability);

      const result = await capability.getById(invalidQuery);

      if (result.success) {
        assert.fail();
      }
      expect(result.error.type).toBe('InvalidInput');
    });

    it('wraps thrown errors in a Generic error result', async () => {
      const Capability = createOverridingCapabilityClass();
      applyReactionary(Capability, 'getById', {
        inputSchema: QuerySchema,
        outputSchema: z.string(),
      });
      const capability = instantiate(Capability);

      const result = await capability.getById({ id: 'throw' });

      if (result.success) {
        assert.fail();
      }
      expect(result.error.type).toBe('Generic');
    });

    it('still runs the overriding implementation for valid input', async () => {
      const Capability = createOverridingCapabilityClass();
      applyReactionary(Capability, 'getById', {
        inputSchema: QuerySchema,
        outputSchema: z.string(),
      });
      const capability = instantiate(Capability);

      const result = await capability.getById({ id: '1' });

      if (!result.success) {
        assert.fail();
      }
      expect(result.value).toBe('override-1');
    });
  });

  it('throws when the method is not declared on the class itself', () => {
    const Capability = createOverridingCapabilityClass();

    // `getById` exists on the prototype chain of this subclass, but is not
    // overridden here, so there is nothing to (re)decorate.
    class NonOverridingCapability extends Capability {}

    expect(() =>
      applyReactionary(NonOverridingCapability, 'getById', {})
    ).toThrow(/getById/);
  });

  it('only accepts Result-returning operation names', () => {
    const Capability = createOverridingCapabilityClass();

    // @ts-expect-error `helper` is not an async, Result-returning operation
    expect(() => applyReactionary(Capability, 'helper', {})).toThrow();
    // @ts-expect-error `doesNotExist` is not a member of the capability
    expect(() => applyReactionary(Capability, 'doesNotExist', {})).toThrow();
  });
});
