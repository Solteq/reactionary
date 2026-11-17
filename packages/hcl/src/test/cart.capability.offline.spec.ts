import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { assert, describe, expect, it, vi } from 'vitest';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclCartFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';

/** Returns an empty cart instead of reading the order back from HCL. */
class StubbedReadCartCapability extends HclCartCapability {
  protected override async fetchCart() {
    return CartSchema.parse({
      identifier: { key: 'order-1' },
      user: { userId: 'user-1' },
    });
  }
}

describe('HCL Cart Capability (offline)', () => {
  function buildProvider() {
    const reqCtx = createInitialRequestContext();
    const config = HclConfigurationSchema.parse({
      apiUrl: 'https://hcl.example.com/wcs/resources',
      searchApiUrl: 'https://hcl.example.com/search/resources',
      storeId: '41',
    });
    const client = new HclClient(config, reqCtx);
    const callPut = vi.spyOn(client, 'callPut').mockResolvedValue({});
    const provider = new StubbedReadCartCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclCartFactory(
        CartSchema,
        CartIdentifierSchema,
        CartPaginatedSearchResultSchema,
      ),
    );
    return { provider, client, callPut };
  }

  it('remove sets the item quantity to 0 with update_order_item', async () => {
    const { provider, client, callPut } = buildProvider();

    const result = await provider.remove({
      cart: { key: '' },
      item: { key: 'item-1' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    // delete_order_item leaves totalSalesTax stale; quantity 0 recalculates it.
    expect(callPut).toHaveBeenCalledTimes(1);
    expect(callPut).toHaveBeenCalledWith(
      `${client.transactionBaseUrl}/cart/@self/update_order_item`,
      {
        orderItem: [{ orderItemId: 'item-1', quantity: '0' }],
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
    expect(
      callPut.mock.calls.some(([url]) =>
        String(url).includes('delete_order_item'),
      ),
    ).toBe(false);
  });
});
