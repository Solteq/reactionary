import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { attributeFacet, attributeFacets } from './facet-helpers.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaConfigurationSchema } from '../schema/configuration.schema.js';

const searchRequests = vi.hoisted(() => ({ sent: [] as unknown[], responses: [] as unknown[] }));

vi.mock('algoliasearch', () => ({
  algoliasearch: () => ({
    search: async (body: { requests: unknown[] }) => {
      searchRequests.sent = body.requests;
      return { results: searchRequests.responses };
    },
  }),
}));

class TestableSearch extends AlgoliaProductSearchCapability {
  public buildQuery(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }

  public buildSibling(payload: ProductSearchQueryByTerm, key: string) {
    return this.siblingFacetPayload(payload, key);
  }
}

const search = (multiselect: string[] = ['color', 'categories']) =>
  new TestableSearch(
    new NoOpCache(),
    createInitialRequestContext(),
    AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products', facets: { multiselect } }),
    new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, { multiselect }),
  );

const query = (extra: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...extra },
  });

const bucket = (key: string) => ({ facet: { key: 'color' }, key });
const brand = (key: string) => ({ facet: { key: 'manufacturer' }, key });

const response = (queryID: string, facets: Record<string, Record<string, number>>, hitsPerPage = 10) => ({
  hits: [],
  facets,
  queryID,
  index: 'products_en',
  nbHits: 0,
  nbPages: 0,
  page: 0,
  hitsPerPage,
});

describe('Algolia multiselect facets', () => {
  beforeEach(() => {
    searchRequests.sent = [];
    searchRequests.responses = [];
  });

  it('ANDs every selected value, as before, without multiselect', () => {
    const sent = search([]).buildQuery(query({ facets: [bucket('4'), bucket('5'), brand('Bosch')] }));

    expect(sent.facetFilters).toEqual(['color:4', 'color:5', 'manufacturer:Bosch']);
  });

  it('ORs the values of a multiselect facet and ANDs the rest', () => {
    const sent = search().buildQuery(
      query({ facets: [bucket('4'), brand('Bosch'), bucket('5')] }),
    );

    expect(sent.facetFilters).toEqual(['manufacturer:Bosch', ['color:4', 'color:5']]);
  });

  it('never treats the categories facet as multiselect', () => {
    const sent = search().buildQuery(
      query({ facets: [{ facet: { key: 'categories' }, key: 'Tools' }] }),
    );

    expect(sent.facetFilters).toEqual([]);
    expect(sent.filters).toBe('categories:"Tools"');
  });

  it('asks for the siblings without the selection, one hit and no analytics', () => {
    const payload = query({ facets: [bucket('4'), brand('Bosch')] });
    const sent = search().buildSibling(payload, 'color');

    expect(sent).toMatchObject({
      facets: ['color'],
      hitsPerPage: 1,
      analytics: false,
      clickAnalytics: false,
      facetFilters: ['manufacturer:Bosch'],
    });
  });

  it('sends one request when no multiselect facet has a value selected', async () => {
    searchRequests.responses = [response('main', { color: { '4': 3 } })];

    await search().queryByTerm(query({}));

    expect(searchRequests.sent).toHaveLength(1);
    expect(searchRequests.sent[0]).toMatchObject({ analytics: true, clickAnalytics: true });
  });

  it('keeps the first request as the one that counts, and takes the siblings from the others', async () => {
    searchRequests.responses = [
      response('main-query', { color: { '4': 3 }, manufacturer: { Bosch: 3 } }),
      response('sibling-query', { color: { '3': 2, '4': 3, '5': 1 } }, 1),
    ];

    const result = await search().queryByTerm(query({ facets: [bucket('4')] }));

    expect(searchRequests.sent).toHaveLength(2);
    expect(searchRequests.sent[0]).toMatchObject({ analytics: true, clickAnalytics: true });
    expect(searchRequests.sent[1]).toMatchObject({ analytics: false, clickAnalytics: false, hitsPerPage: 1 });

    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.identifier.key).toBe('main-query');
    expect(result.value.identifier).not.toHaveProperty('multiselect');
    const facets = result.value.facets;
    expect(attributeFacets(facets).map((f) => f.identifier.key)).toEqual(['color', 'manufacturer']);
    const reviews = attributeFacet(facets, 'color');
    expect(reviews?.values.map((v) => [v.identifier.key, v.count, v.active])).toEqual([
      ['3', 2, false],
      ['4', 3, true],
      ['5', 1, false],
    ]);
  });
});
