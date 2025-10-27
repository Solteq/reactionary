import 'dotenv/config';
import { createInitialRequestContext, NoOpCache, SearchQueryByTermSchema, SearchResultSchema } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaSearchProvider } from '../providers/search.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';

describe('Medusa Search Provider', () => {
  const provider = new MedusaSearchProvider(
    getMedusaTestConfiguration(),
    SearchResultSchema,
    new NoOpCache()
  );

  const reqCtx = createInitialRequestContext();

  it('should be able to get a result by term', async () => {
    const result = await provider.queryByTerm(SearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 20,
      facets: [],
    }}), reqCtx);

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.facets.length).toBe(0);
  });

  it('should be able to paginate', async () => {
    const firstPage = await provider.queryByTerm(SearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 2,
      facets: [],
    }}), reqCtx);

    const secondPage = await provider.queryByTerm(SearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 2,
      pageSize: 2,
      facets: [],
    }}), reqCtx);

    expect(firstPage.identifier.page).toBe(1);
    expect(secondPage.identifier.page).toBe(2);
    expect(firstPage.products[0].identifier.key).not.toEqual(
      secondPage.products[0].identifier.key
    );
  });

  it('should be able to change page size', async () => {
    const smallPage = await provider.queryByTerm(SearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 2,
      facets: [],
    }}), reqCtx);
    const largePage = await provider.queryByTerm(SearchQueryByTermSchema.parse({ search: {
      term: 'glass',
      page: 1,
      pageSize: 30,
      facets: [],
    }}), reqCtx);

    expect(smallPage.products.length).toBe(2);
    expect(smallPage.identifier.pageSize).toBe(2);
    expect(largePage.products.length).toBe(30);
    expect(largePage.identifier.pageSize).toBe(30);
  });

});
