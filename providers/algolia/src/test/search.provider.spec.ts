import 'dotenv/config';
import { createInitialRequestContext, NoOpCache, ProductSearchResultItemSchema, ProductSearchResultSchema } from '@reactionary/core';
import { AlgoliaSearchProvider } from '../providers/product-search.provider.js';
import { describe, expect, it } from 'vitest';

describe('Algolia Search Provider', () => {
  const provider = new AlgoliaSearchProvider(
    {
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    },
    ProductSearchResultItemSchema,
    new NoOpCache()
  );

  const reqCtx = createInitialRequestContext();

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 1,
        pageSize: 20
      },
      facets: [],
      filters: []
    }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.facets.length).toBe(2);
    expect(result.facets[0].values.length).toBeGreaterThan(0);
    expect(result.facets[1].values.length).toBeGreaterThan(0);
  });

  it('should be able to paginate', async () => {
    const firstPage = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 1,
        pageSize: 20,
      },
      facets: [],
    }}, reqCtx);

    const secondPage = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 2,
        pageSize: 20,
      },
      facets: [],
      filters: [],
    }}, reqCtx);
    expect(firstPage.pageNumber).toBe(1);
    expect(secondPage.pageNumber).toBe(2);
    expect(firstPage.items[0].identifier.key).not.toEqual(
      secondPage.items[0].identifier.key
    );
  });

  it('should be able to change page size', async () => {
    const smallPage = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
      facets: [],
      filters: []
    }}, reqCtx);
    const largePage = await provider.queryByTerm({ search: {
      term: 'glass',

      paginationOptions: {
        pageNumber: 1,
        pageSize: 30,
      },
      facets: [],
      filters: [],
    }}, reqCtx);

    expect(smallPage.items.length).toBe(2);
    expect(smallPage.pageSize).toBe(2);
    expect(largePage.items.length).toBe(30);
    expect(largePage.pageSize).toBe(30);
  });

  it('should be able to apply facets', async () => {
    const initial = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
      facets: [],
      filters: [],
    }}, reqCtx);

    const filtered = await provider.queryByTerm({ search: {
      term: 'glass',
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
      facets: [initial.facets[0].values[0].identifier],
      filters: [],
    }}, reqCtx);

    expect(initial.totalPages).toBeGreaterThan(filtered.totalPages);
  });
});
