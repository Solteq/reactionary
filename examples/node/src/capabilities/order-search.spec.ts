import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  searchTerm: '',
  sku: '0766623301831'
};

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Order Search Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    // Technically, i should create a bunch of orders first, but a) that would make the test way longer, and b) they would all be on the same day with same statuses.
    it('can be called by anonymous users', async () => {
      const result = await client.orderSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          filters: [],
        },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }
    });

    it('can be called by guest users', async () => {
      const updatedCart = await client.cart.add(
              {
                quantity: 1,
                variant: {
                  sku: testData.sku
                },
              }
            );
      const identity = await client.identity.getSelf({});

      if (!identity.success) {
        assert.fail();
      }

      expect(identity.value.type).toBe('Guest');

      const result = await client.orderSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          filters: [],
        },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }
    });

    it('can be called by an authenticated user', async () => {
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
      const result = await client.orderSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          filters: [],
        },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

    });
    it.skip('can filter by startDate', async () => {
      /** TODO */
    });

    it.skip('can filter by endDate', async () => {
      /** TODO */
    });

    it.skip('can filter by orderStatus', async () => {
      /** TODO */
    });

    it.skip('can filter by multiple orderStatuses', async () => {
      /** TODO */
    });

    it.skip('can filter by partNumber', async () => {
      /** TODO */
    });


    it.skip('can page the resultset', async () => {
      const result = await client.orderSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          filters: [],
        },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      const result2 = await client.orderSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 2,
            pageSize: 2,
          },
          filters: [],
        },
      });

      if (!result2.success) {
        assert.fail(JSON.stringify(result2.error));
      }

      expect(result.value.items[0].identifier).not.toBe(
        result2.value.items[0].identifier
      );
    });
  }

);
