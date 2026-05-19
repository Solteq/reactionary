import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  searchTerm: 'Brother',
  searchTermWithLanguage: 'Brother',
  category: {
    lvl0: 'Computers & Peripherals',
    lvl1: 'Computers & Peripherals > Computer Cables',
    lvl2: 'Computers & Peripherals > Computer Cables > Audio Cables',
  }
};

describe.each([PrimaryProvider.ALGOLIA, PrimaryProvider.COMMERCETOOLS,PrimaryProvider.MEILISEARCH, PrimaryProvider.MEDUSA])(
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
            pageSize: 12,
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
      expect(largePage.value.items.length).toBeGreaterThan(10);
      expect(largePage.value.pageSize).toBe(12);
    });

    it('should be able to apply facets', async () => {
      if (provider === PrimaryProvider.MEDUSA) {
        // Medusa's own search doesn't support faceting yet, so we skip this test for that provider
        return;
      }

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
      if (provider === PrimaryProvider.MEDUSA) {
        // Medusa's own search doesn't support faceting yet, so we skip this test for that provider
        return;
      }
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
      if (provider === PrimaryProvider.MEDUSA) {
        // Medusa's own search doesn't support faceting yet, so we skip this test for that provider
        return;
      }
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



    it.skip('can apply a top level category filter', async () => {
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


describe.each([PrimaryProvider.ALGOLIA, PrimaryProvider.COMMERCETOOLS,PrimaryProvider.MEILISEARCH, PrimaryProvider.MEDUSA])('Multilingual Product Search', (provider) => {
  let client: ReturnType<typeof createClient>;


  it('can get results in other languages', async () => {
    client = createClient(provider, {
      languageContext: {
        locale: 'en-US',
        currencyCode: 'USD'
      },
    });

    const result = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTermWithLanguage,
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


    const altLanguageClient = createClient(provider, {
      languageContext: {
        locale: 'da-DK',
        currencyCode: 'EUR'
      },
    });

    const altResult = await altLanguageClient.productSearch.queryByTerm({
      search: {
        term: testData.searchTermWithLanguage,
        facets: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10,
        },
        filters: [],
      },
    });

    if (!altResult.success) {
      assert.fail(JSON.stringify(altResult.error));
    }
    const firstItem = result.value.items[0];
    const altFirstItem = altResult.value.items.find(x => x.identifier.key === firstItem.identifier.key);

    // we check that the name is different and hope the same product is in both test sets
    expect(altFirstItem).toBeDefined();
    expect(altFirstItem!.name).not.toBe(firstItem.name);
  });


  it('get facets in other languages', async () => {
      if (provider === PrimaryProvider.MEDUSA) {
        // Medusa's own search doesn't support faceting yet, so we skip this test for that provider
        return;
      }


    client = createClient(provider, {
      languageContext: {
        locale: 'en-US',
        currencyCode: 'USD'
      },
    });

    const result = await client.productSearch.queryByTerm({
      search: {
        term: "*",
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

    expect(result.value.facets.length).toBeGreaterThan(0);

    const altLanguageClient = createClient(provider, {
      languageContext: {
        locale: 'fi-FI',
        currencyCode: 'EUR'
      },
    });

    const altResult = await altLanguageClient.productSearch.queryByTerm({
      search: {
        term: "*",
        facets: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10,
        },
        filters: [],
      },
    });

    if (!altResult.success) {
      assert.fail(JSON.stringify(altResult.error));
    }

    const firstFacet = result.value.facets.find(x => x.identifier.key.startsWith('attributes.'));
    expect(firstFacet).toBeDefined();


    const altFirstFacet = altResult.value.facets.find(x => x.identifier.key.startsWith('attributes.'));
    expect(altFirstFacet).toBeDefined();
    expect(altFirstFacet!.values.length).toBeGreaterThan(0);
    expect(altFirstFacet!.values[0].name).not.toBe(firstFacet!.values[0].name);
  });
});



describe.each([ PrimaryProvider.ALGOLIA, PrimaryProvider.MEILISEARCH])('Weird Facets', (provider) => {
  let client: ReturnType<typeof createClient>;

  it('should only return one category facet even if there are multiple levels of category hierarchy', async () => {
    client = createClient(provider);

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
      assert.fail(JSON.stringify(result.error));
    }
    const categoryFacets = result.value.facets.filter(x => x.identifier.key === 'categories');
    expect(categoryFacets.length).toBe(1);
  });
  it('should only return one category facet when a category facet value lvl 0 is set ', async () => {
    client = createClient(provider);

    const baseResult = await client.productSearch.queryByTerm({
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

    if (!baseResult.success) {
      assert.fail(JSON.stringify(baseResult.error));
    }


    const result = await client.productSearch.queryByTerm({
      search: {
        term: "*",
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10,
        },
        facets: [{
          facet: {
            key: 'categories'
          },
          key: testData.category.lvl0
        }],
        filters: [],
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }
    const categoryFacets = result.value.facets.filter(x => x.identifier.key === 'categories');
    expect(categoryFacets.length).toBe(1);
    expect(result.value.totalCount).toBeGreaterThan(0);

  });
  it('should only return one category facet when a category facet value lvl 1 is set ', async () => {
    client = createClient(provider);

    const baseResult = await client.productSearch.queryByTerm({
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

    if (!baseResult.success) {
      assert.fail(JSON.stringify(baseResult.error));
    }


    const result = await client.productSearch.queryByTerm({
      search: {
        term: "*",
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10,
        },
        facets: [{
          facet: {
            key: 'categories'
          },
          key: testData.category.lvl1
        }],
        filters: [],
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }
    const categoryFacets = result.value.facets.filter(x => x.identifier.key === 'categories');
    expect(categoryFacets.length).toBe(1);
    expect(result.value.totalCount).toBeGreaterThan(0);
      expect(result.value.totalCount).toBeLessThan(baseResult.value.totalCount);
  });


  it('should only return no category facet when a category facet value lvl 2 is set ', async () => {
    client = createClient(provider);

    const baseResult = await client.productSearch.queryByTerm({
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

    if (!baseResult.success) {
      assert.fail(JSON.stringify(baseResult.error));
    }

    const result = await client.productSearch.queryByTerm({
      search: {
        term: "*",
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10,
        },
        facets: [{
          facet: {
            key: 'categories'
          },
          key: testData.category.lvl2
        }],
        filters: [],
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }
    const categoryFacets = result.value.facets.filter(x => x.identifier.key === 'categories');
    expect(categoryFacets.length).toBe(0);
    expect(result.value.totalCount).toBeGreaterThan(0);
    expect(result.value.totalCount).toBeLessThan(baseResult.value.totalCount);

  });



  it('should be able to use facets with / in the name', async () => {
    client = createClient(provider, {
      languageContext: {
        locale: 'nb-NO',
        currencyCode: 'EUR'
      },
     });

    const result = await client.productSearch.queryByTerm({
      search: {
        term: "*",
        facets: [{
          facet: {
          key: 'attributes.Modell/Type',
          },
          key: 'some-value'
        }],
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
});
