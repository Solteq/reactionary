import 'dotenv/config';
import { createInitialRequestContext, NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultItemSchema } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaSearchProvider } from '../providers/product-search.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../index.js';

const testData = {
  searchTerm: 'printer',
}
describe('Medusa Search Provider', () => {
  const reqCtx = createInitialRequestContext();
  const client = new MedusaClient(getMedusaTestConfiguration(), reqCtx);
  const provider = new MedusaSearchProvider(
    getMedusaTestConfiguration(),
    ProductSearchResultItemSchema,
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

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.facets.length).toBe(0);
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

    expect(firstPage.pageNumber).toBe(1);
    expect(secondPage.pageNumber).toBe(2);
    expect(firstPage.items[0].identifier.key).not.toEqual(
      secondPage.items[0].identifier.key
    );
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

    expect(smallPage.items.length).toBe(2);
    expect(smallPage.pageSize).toBe(2);
    expect(largePage.items.length).toBe(30);
    expect(largePage.pageSize).toBe(30);
  });

});
