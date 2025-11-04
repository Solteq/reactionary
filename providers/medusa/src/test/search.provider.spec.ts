import 'dotenv/config';
import { createInitialRequestContext, NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultItemSchema, ProductSearchResultSchema } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaSearchProvider } from '../providers/product-search.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';

describe('Medusa Search Provider', () => {
  const provider = new MedusaSearchProvider(
    getMedusaTestConfiguration(),
    ProductSearchResultItemSchema,
    new NoOpCache()
  );

  const reqCtx = createInitialRequestContext();

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 20,
      facets: [],
    }}), reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.facets.length).toBe(0);
  });

  it('should be able to paginate', async () => {
    const firstPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 2,
      facets: [],
    }}), reqCtx);

    const secondPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 2,
      pageSize: 2,
      facets: [],
    }}), reqCtx);

    expect(firstPage.pageNumber).toBe(1);
    expect(secondPage.pageNumber).toBe(2);
    expect(firstPage.items[0].identifier.key).not.toEqual(
      secondPage.items[0].identifier.key
    );
  });

  it('should be able to change page size', async () => {
    const smallPage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 2,
      facets: [],
    }}), reqCtx);
    const largePage = await provider.queryByTerm(ProductSearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 30,
      facets: [],
    }}), reqCtx);

    expect(smallPage.items.length).toBe(2);
    expect(smallPage.pageSize).toBe(2);
    expect(largePage.items.length).toBe(30);
    expect(largePage.pageSize).toBe(30);
  });

});
