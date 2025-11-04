import type { RequestContext } from '@reactionary/core';
import { NoOpCache, ProductSearchResultItemSchema, createInitialRequestContext } from '@reactionary/core';
import 'dotenv/config';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CommercetoolsSearchProvider } from '../providers/product-search.provider.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';

const testData = {
  searchTerm: 'bowl'
}

describe('Commercetools Search Provider', () => {

  let provider: CommercetoolsSearchProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new CommercetoolsSearchProvider(getCommercetoolsTestConfiguration(), ProductSearchResultItemSchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  })

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
      filters: []
    }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
  });


    it('should be able to get a result by term, paged', async () => {
    const result = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 1,
      },
      filters: []
    }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(1);

    const result2 = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 2,
        pageSize: 1,
      },
      filters: []
    }}, reqCtx);

    expect(result2.items.length).toBeGreaterThan(0);
    expect(result2.totalPages).toBeGreaterThan(2);
    expect(result2.items[0].identifier.key).not.toBe(result.items[0].identifier.key);
  });
});
