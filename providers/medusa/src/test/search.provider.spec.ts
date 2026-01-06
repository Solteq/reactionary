import 'dotenv/config';
import { createInitialRequestContext, NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultItemSchema, type ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';
import { assert, describe, expect, it } from 'vitest';
import { MedusaSearchProvider } from '../providers/product-search.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaAPI } from '../index.js';
import { MedusaCategoryProvider } from '../providers/category.provider.js';

const testData = {
  searchTerm: 'printer',
}
describe('Medusa Search Provider', () => {
  const reqCtx = createInitialRequestContext();
  const client = new MedusaAPI(getMedusaTestConfiguration(), reqCtx);
  const provider = new MedusaSearchProvider(
    getMedusaTestConfiguration(),
    new NoOpCache(),
    reqCtx,
    client
  );

  const categoryProvider = new MedusaCategoryProvider(
    getMedusaTestConfiguration(),
    new NoOpCache(),
    reqCtx,
    client
  );

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: testData.searchTerm,
      paginationOptions: {
        pageNumber: 1,
        pageSize: 20,
      },
      facets: [],
      filters: [],
    }}));

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.facets.length).toBe(0);
  });

  it('should be able to paginate', async () => {
    const firstPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: testData.searchTerm,
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
      facets: [],
      filters: []
    }}));

    const secondPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: testData.searchTerm,
      paginationOptions: {
        pageNumber: 2,
        pageSize: 2
      },
      facets: [],
      filters: []
    }}));

    if (!firstPage.success || !secondPage.success) {
      assert.fail();
    }

    expect(firstPage.value.pageNumber).toBe(1);
    expect(secondPage.value.pageNumber).toBe(2);
    expect(firstPage.value.items[0].identifier.key).not.toEqual(
      secondPage.value.items[0].identifier.key
    );
  });

  it ('should be able to apply a top level category filter', async () => {
      // First, get a category to filter on
      const categories = await categoryProvider.findTopCategories({
        paginationOptions: {
          pageNumber: 1,
          pageSize: 2,
        },
      });

      if (!categories.success) {
        assert.fail();
      }

      // medusa does not support subtree searches, so we have to drill down to a leaf category
      let candidate = categories.value.items[0];
      while(candidate) {
        const children = await categoryProvider.findChildCategories({
          parentId: candidate.identifier,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
        });

        if (!children.success) {
          assert.fail();
        }

        if(children.value.items.length > 0) {
          candidate = children.value.items[0];
        } else {
          break;
        }
      }

      const unfilteredSearch = await provider.queryByTerm({
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

      if (!unfilteredSearch.success) {
        assert.fail();
      }

      expect(unfilteredSearch.value.totalCount).toBeGreaterThan(0);

      const breadCrumb = await categoryProvider.getBreadcrumbPathToCategory({
        id: candidate.identifier,
      });

      if (!breadCrumb.success) {
        assert.fail();
      }

      expect(breadCrumb.value.length).toBeGreaterThan(0);

      const categoryFilter = await provider.createCategoryNavigationFilter({
        categoryPath: breadCrumb.value,
      } satisfies ProductSearchQueryCreateNavigationFilter);

      if (!categoryFilter.success) {
        assert.fail();
      }

      const filteredSearch = await provider.queryByTerm({
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

  it('should be able to change page size', async () => {
    const smallPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: testData.searchTerm,
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
      facets: [],
      filters: [],
    }}));

    const largePage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: testData.searchTerm,
      paginationOptions: {
        pageNumber: 1,
        pageSize: 30,
      },
      facets: [],
      filters: [],
    }}));

    if (!smallPage.success || !largePage.success) {
      assert.fail();
    }

    expect(smallPage.value.items.length).toBe(2);
    expect(smallPage.value.pageSize).toBe(2);
    expect(largePage.value.items.length).toBe(30);
    expect(largePage.value.pageSize).toBe(30);
  });

});
