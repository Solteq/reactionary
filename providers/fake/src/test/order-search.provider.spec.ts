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
import { FakeOrderSearchProvider } from '../providers/order-search.provider.js';

describe('Fake Order Search Provider', () => {
  let provider: FakeOrderSearchProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeOrderSearchProvider(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx
    );
  });

  describe('should have operations return structurally valid data', () => {
    it('for queryByTerm', async () => {
      const result = await provider.queryByTerm({
        search: {
          term: '1234',
          filters: [],
          paginationOptions: {
            pageNumber: 1,
            pageSize: 12,
          },
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier).toBeDefined();
    });
  });
});
