import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartSchema,
  IdentitySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeCartProvider } from '../providers/cart.provider.js';
import { FakeIdentityProvider } from '../providers/index.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';
import { FakeCheckoutProvider } from '../providers/checkout.provider.js';
import { FakeOrderProvider } from '../providers/order.provider.js';

describe('Fake Order Provider', () => {
  let provider: FakeOrderProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeOrderProvider(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx
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
