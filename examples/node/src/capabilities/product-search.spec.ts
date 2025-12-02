import 'dotenv/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  searchTerm: 'manhattan',
};

describe.each([PrimaryProvider.ALGOLIA, PrimaryProvider.COMMERCETOOLS])(
  'Product Search Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to get a result by term', async () => {
      const result = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          facets: [],
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          filters: [],
        },
      });

      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should be able to get a result by term, paged', async () => {
      const result = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          facets: [],
          paginationOptions: {
            pageNumber: 1,
            pageSize: 1,
          },
          filters: [],
        },
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThan(1);

      const result2 = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          facets: [],
          paginationOptions: {
            pageNumber: 2,
            pageSize: 1,
          },
          filters: [],
        },
      });

      expect(result2.items.length).toBeGreaterThan(0);
      expect(result2.totalPages).toBeGreaterThan(2);
      expect(result2.items[0].identifier.key).not.toBe(
        result.items[0].identifier.key
      );
    });

    it('should be able to change page size', async () => {
      const smallPage = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [],
          filters: [],
        },
      });
      const largePage = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,

          paginationOptions: {
            pageNumber: 1,
            pageSize: 30,
          },
          facets: [],
          filters: [],
        },
      });

      expect(smallPage.items.length).toBe(2);
      expect(smallPage.pageSize).toBe(2);
      expect(largePage.items.length).toBe(30);
      expect(largePage.pageSize).toBe(30);
    });

    it('should be able to apply facets', async () => {

      const initial = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [],
          filters: [],
        },
      });

      expect(initial.facets.length).toBeGreaterThan(0);

      const filtered = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [initial.facets[0].values[0].identifier],
          filters: [],
        },
      });

      expect(initial.totalPages).toBeGreaterThanOrEqual(filtered.totalPages);
    });

    it('should not return facets with no values', async () => {
      const result = await client.productSearch.queryByTerm({
        search: {
          term: testData.searchTerm,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          facets: [],
          filters: [],
        },
      });

      for (const facet of result.facets) {
        expect(facet.values.length).toBeGreaterThan(0);
      }
    });
  }
);
