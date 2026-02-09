import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  searchTerm: '',
  sku: '0766623301831',
  customerName: 'Eileen Harvey',
  email: 'eileen.harvey@example.com',
};

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEILISEARCH])(
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
      const updatedCart = await client.cart.add({
        quantity: 1,
        variant: {
          sku: testData.sku,
        },
      });
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
      const identity = await client.identity.register({
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      });

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

    describe('filters', () => {


      beforeEach(async () => {
        const time = new Date().getTime();
        const identity = await client.identity.login({ username: testData.email,
          password: 'Test1234!'
        });

        if (!identity.success) {
          assert.fail();
        }
        expect(identity.value.type).toBe('Registered');
      });

      it('has some test orders', async () => {
        const result = await client.orderSearch.queryByTerm({
          search: {
            term: '',
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

        expect(result.value.items.length).toBeGreaterThan(0);
      });

      it('can filter by part number', async () => {

        const result = await client.orderSearch.queryByTerm({
          search: {
            term: '',
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


        const result2 = await client.orderSearch.queryByTerm({
          search: {
            term: '',
            partNumber: [testData.sku],
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
            filters: [],
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBeGreaterThan(0);
        expect(result2.value.totalCount).toBeLessThanOrEqual(result.value.totalCount);
      });

      it('can filter by search term', async () => {
        const result = await client.orderSearch.queryByTerm({
          search: {
            term: 'cable',
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
        expect(result.value.items.length).toBeGreaterThan(0);
      });



      it('can paginate results', async () => {
        const result = await client.orderSearch.queryByTerm({
          search: {
            term: '',
            paginationOptions: {
              pageNumber: 1,
              pageSize: 1,
            },
            filters: [],
          },
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        expect(result.value.items.length).toBe(1);

        const result2 = await client.orderSearch.queryByTerm({
          search: {
            term: '',
            paginationOptions: {
              pageNumber: 2,
              pageSize: 1,
            },
            filters: [],
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBe(1);
        expect(result2.value.items[0].identifier.key).not.toBe(
          result.value.items[0].identifier.key
        );
      });

      it('can filter by order status', async () => {
        const result = await client.orderSearch.queryByTerm({
          search: {
            term: '',
            orderStatus: ['Shipped'],
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
        expect(result.value.items.length).toBeGreaterThan(0);

        const result2 = await client.orderSearch.queryByTerm({
          search: {
            term: '',
            orderStatus: ['Cancelled'],
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
            filters: [],
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBe(0);
      });
    });
  }
);
