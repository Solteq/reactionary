import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { OrderIdentifier, ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  searchTerm: '',
  sku: '0766623301831',
};

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Order Search Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it.skip('can be called by guest users', async () => {
      const updatedCart = await client.cart.add(
              {
                quantity: 1,
                variant: {
                  sku: testData.sku
                },
              }
            );
      // create order....somehow.....

      const orderId: OrderIdentifier = { key: '123456'};
      const identity = await client.identity.getSelf({});
      if (!identity.success) {
        assert.fail();
      }

      expect(identity.value.type).toBe('Guest');
      const result = await client.order.getById({ order: orderId });
      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      const order = result.value;
      expect(order.identifier.key).toBe(orderId.key);
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.price.grandTotal.value).toBeGreaterThan(0);

    });

    it.skip('can be called by registered users', async () => {
      const time = new Date().getTime();
      const identity = await client.identity.register(
        {
          username: `test-user+${time}@example.com`,
          password: 'love2test',
        }
      );

      if (!identity.success) {
        assert.fail();
      }

      expect(identity.value.type).toBe('Registered');

      const updatedCart = await client.cart.add(
              {
                quantity: 1,
                variant: {
                  sku: testData.sku
                },
              }
            );
      // create order....somehow.....

      const orderId: OrderIdentifier = { key: '456789'};


      expect(identity.value.type).toBe('Guest');
      const result = await client.order.getById({ order: orderId });
      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      const order = result.value;
      expect(order.identifier.key).toBe(orderId.key);
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.price.grandTotal.value).toBeGreaterThan(0);
    });


});
