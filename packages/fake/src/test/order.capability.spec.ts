import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  OrderSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';
import { FakeOrderCapability } from '../capabilities/order.capability.js';
import { FakeOrderFactory } from '../factories/index.js';

describe('Fake Order Provider', () => {
  let provider: FakeOrderCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeOrderCapability(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      new FakeOrderFactory(OrderSchema),
    );
  });

  describe('should have operations return structurally valid data', () => {
    it('for getById', async () => {
      const result = await provider.getById({
        order: {
          key: '1234'
        }
      })

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.key).toBe('1234');
    });
  });
});
