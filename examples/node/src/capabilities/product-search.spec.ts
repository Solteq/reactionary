import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

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

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.items.length).toBeGreaterThan(0);
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

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.items.length).toBeGreaterThan(0);
      expect(result.value.totalPages).toBeGreaterThan(1);

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

      if (!result2.success) {
        assert.fail();
      }

      expect(result2.value.items.length).toBeGreaterThan(0);
      expect(result2.value.totalPages).toBeGreaterThan(2);
      expect(result2.value.items[0].identifier.key).not.toBe(
        result.value.items[0].identifier.key
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
      
      if (!smallPage.success || !largePage.success) {
        assert.fail();
      }

      expect(smallPage.value.items.length).toBe(2);
      expect(smallPage.value.pageSize).toBe(2);
      expect(largePage.value.items.length).toBe(30);
      expect(largePage.value.pageSize).toBe(30);
    });

    it('should be able to apply facets', async () => {
      const initial = await client.productSearch.queryByTerm({
        search: {
          term: "",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [],
          filters: [],
        },
      });

      if (!initial.success) {
        assert.fail();
      }

      expect(initial.value.facets.length).toBeGreaterThan(0);

      const filtered = await client.productSearch.queryByTerm({
        search: {
          term: "",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [initial.value.facets[0].values[0].identifier],
          filters: [],
        },
      });

      if (!filtered.success) {
        assert.fail();
      }

      expect(initial.value.totalCount).toBeGreaterThan(filtered.value.totalCount);
      expect(filtered.value.totalCount).toBeGreaterThan(0);
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

      if (!result.success) {
        assert.fail();
      }

      for (const facet of result.value.facets) {
        expect(facet.values.length).toBeGreaterThan(0);
      }
    });


    it('can apply a category facet', async () => {
      const result = await client.productSearch.queryByTerm({
        search: {
          term: "*",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          facets: [],
          filters: [],
        },
      });

      if (!result.success) {
        assert.fail();
      }

      const categoryFacet = result.value.facets.find(
        (f) => f.identifier.key === 'categories'
      );
      expect(categoryFacet).toBeDefined();
      const chosenFacet = categoryFacet!.values[0]!;

      const narrowedResult = await client.productSearch.queryByTerm({
        search: {
          term: "*",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          facets: [chosenFacet.identifier],
          filters: [],
        },
      });

      if (!narrowedResult.success) {
        assert.fail();
      }

      expect(narrowedResult.value.totalCount).toBeLessThan(result.value.totalCount);
      expect(narrowedResult.value.totalCount).toBeGreaterThan(0);
      expect(narrowedResult.value.totalCount).toBe(chosenFacet.count);

    });



    it('can apply a top level category filter', async () => {
      // First, get a category to filter on
      const categories = await client.category.findTopCategories({
        paginationOptions: {
          pageNumber: 1,
          pageSize: 2,
        },
      });


      const unfilteredSearch = await client.productSearch.queryByTerm({
        search: {
          term: "",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 1,
          },
          facets: [],
          filters: [],
        },
      });

      if (!unfilteredSearch.success || !categories.success) {
        assert.fail();
      }

      expect(unfilteredSearch.value.totalCount).toBeGreaterThan(0);

      const breadCrumb = await client.category.getBreadcrumbPathToCategory({
        id: categories.value.items[1].identifier,
      });

      if (!breadCrumb.success) {
        assert.fail();
      }

      expect(breadCrumb.value.length).toBeGreaterThan(0);

      const categoryFilter = await client.productSearch.createCategoryNavigationFilter({
        categoryPath: breadCrumb.value,
      } satisfies ProductSearchQueryCreateNavigationFilter);

      if (!categoryFilter.success) {
        assert.fail();
      }

      const filteredSearch = await client.productSearch.queryByTerm({
        search: {
          term: "",
          categoryFilter: categoryFilter.value,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 1,
          },
          facets: [],
          filters: [],
        },
      });

      if (!filteredSearch.success) {
        assert.fail();
      }

      expect(filteredSearch.value.totalCount).toBeLessThan(unfilteredSearch.value.totalCount);
      expect(filteredSearch.value.totalCount).toBeGreaterThan(0);
    });
  }
);
