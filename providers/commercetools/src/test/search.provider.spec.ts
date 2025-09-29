import 'dotenv/config';
import { NoOpCache, RequestContext, SearchResultSchema, createInitialRequestContext } from '@reactionary/core';
import { CommercetoolsSearchProvider } from '../providers/search.provider';
import { getCommercetoolsTestConfiguration } from './test-utils';

const testData = {
  searchTerm: 'bowl'
}

describe('Commercetools Search Provider', () => {

  let provider: CommercetoolsSearchProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new CommercetoolsSearchProvider(getCommercetoolsTestConfiguration(), SearchResultSchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  })

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      page: 1,
      pageSize: 10,
    }}, reqCtx);

    expect(result.products.length).toBeGreaterThan(0);
  });


    it('should be able to get a result by term, paged', async () => {
    const result = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      page: 1,
      pageSize: 1,
    }}, reqCtx);

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.pages).toBeGreaterThan(1);

    const result2 = await provider.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      page: 2,
      pageSize: 1,
    }}, reqCtx);

    expect(result2.products.length).toBeGreaterThan(0);
    expect(result2.pages).toBeGreaterThan(2);
    expect(result2.products[0].identifier.key).not.toBe(result.products[0].identifier.key);
  });
});
