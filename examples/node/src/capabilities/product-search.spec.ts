import 'dotenv/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
          term: "",
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
          term: "",
          paginationOptions: {
            pageNumber: 1,
            pageSize: 2,
          },
          facets: [initial.facets[0].values[0].identifier],
          filters: [],
        },
      });

      expect(initial.totalCount).toBeGreaterThan(filtered.totalCount);
      expect(filtered.totalCount).toBeGreaterThan(0);
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

      const categoryFacet = result.facets.find(
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
      expect(narrowedResult.totalCount).toBeLessThan(result.totalCount);
      expect(narrowedResult.totalCount).toBeGreaterThan(0);
      expect(narrowedResult.totalCount).toBe(chosenFacet.count);

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

      expect(unfilteredSearch.totalCount).toBeGreaterThan(0);

      const breadCrumb = await client.category.getBreadcrumbPathToCategory({
        id: categories.items[1].identifier,
      });
      expect(breadCrumb.length).toBeGreaterThan(0);

      const categoryFilter = await client.productSearch.createCategoryNavigationFilter({
        categoryPath: breadCrumb,
      } satisfies ProductSearchQueryCreateNavigationFilter);

      const filteredSearch = await client.productSearch.queryByTerm({
        search: {
          term: "",
          categoryFilter: categoryFilter,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 1,
          },
          facets: [],
          filters: [],
        },
      });

      expect(filteredSearch.totalCount).toBeLessThan(unfilteredSearch.totalCount);
      expect(filteredSearch.totalCount).toBeGreaterThan(0);
    });
  }
);
