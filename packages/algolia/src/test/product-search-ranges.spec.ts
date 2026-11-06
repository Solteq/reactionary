import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
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

  public buildBounds(payload: ProductSearchQueryByTerm, keys: string[]) {
    return this.rangeBoundsPayload(payload, keys);
  }
}

const config = AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products' });

const search = () =>
  new TestableSearch(new NoOpCache(), createInitialRequestContext(), config, new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema));

const query = (extra: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...extra },
  });

const minPrice = { key: 'minPrice' };
const maxPrice = { key: 'maxPrice' };
const inRange = [
  { facet: maxPrice, min: 1000 },
  { facet: minPrice, max: 5000 },
];
const bucket = (key: string) => ({ facet: { key: 'reviewBucket' }, key });

const stats = (min: number, max: number) => ({ min, max, avg: (min + max) / 2, sum: min + max });

const response = (
  queryID: string,
  facets: Record<string, Record<string, number>>,
  facetsStats: Record<string, ReturnType<typeof stats>> = {},
  hitsPerPage = 10,
) => ({
  hits: [],
  facets,
  facets_stats: facetsStats,
  queryID,
  index: 'products_en',
  nbHits: 0,
  nbPages: 0,
  page: 0,
  hitsPerPage,
});

describe('Algolia range filters', () => {
  beforeEach(() => {
    searchRequests.sent = [];
    searchRequests.responses = [];
  });

  it('sends no numeric filters without ranges', () => {
    expect(search().buildQuery(query({}))).not.toHaveProperty('numericFilters');
  });

  it('sends every bound as a numeric filter', () => {
    expect(search().buildQuery(query({ ranges: inRange })).numericFilters).toEqual(['maxPrice>=1000', 'minPrice<=5000']);
  });

  it('sends both bounds of one range', () => {
    expect(search().buildQuery(query({ ranges: [{ facet: minPrice, min: 100, max: 900 }] })).numericFilters).toEqual([
      'minPrice>=100',
      'minPrice<=900',
    ]);
  });

  it('asks for the stats without the ranges, with one hit and no analytics', () => {
    const payload = query({ ranges: inRange, facets: [bucket('4')] });
    const sent = search().buildBounds(payload, ['maxPrice', 'minPrice']);

    expect(sent).toMatchObject({
      facets: ['maxPrice', 'minPrice'],
      hitsPerPage: 1,
      analytics: false,
      clickAnalytics: false,
      facetFilters: ['reviewBucket:4'],
    });
    expect(sent).not.toHaveProperty('numericFilters');
  });

  it('puts the stats of the search on its facets', async () => {
    searchRequests.responses = [response('main', { minPrice: { '1000': 3 } }, { minPrice: stats(1000, 9000) })];

    const result = await search().queryByTerm(query({}));

    expect(searchRequests.sent).toHaveLength(1);
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets[0].stats).toEqual({ min: 1000, max: 9000 });
  });

  it('sends one request when a range has no bound', async () => {
    searchRequests.responses = [response('main', { minPrice: { '1000': 3 } })];

    await search().queryByTerm(query({ ranges: [{ facet: minPrice }] }));

    expect(searchRequests.sent).toHaveLength(1);
  });

  it('takes the stats of a ranged facet from the search without the ranges', async () => {
    searchRequests.responses = [
      response('main-query', { minPrice: { '2000': 1 }, maxPrice: { '3000': 1 } }, { minPrice: stats(2000, 2000), maxPrice: stats(3000, 3000) }),
      response('bounds-query', { minPrice: { '100': 4, '2000': 1 }, maxPrice: { '3000': 1, '9000': 2 } }, {
        minPrice: stats(100, 2000),
        maxPrice: stats(300, 9000),
      }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: inRange }));

    expect(searchRequests.sent).toHaveLength(2);
    expect(searchRequests.sent[0]).toMatchObject({ analytics: true, clickAnalytics: true, numericFilters: ['maxPrice>=1000', 'minPrice<=5000'] });
    expect(searchRequests.sent[1]).toMatchObject({ analytics: false, clickAnalytics: false, facets: ['maxPrice', 'minPrice'] });
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.identifier.key).toBe('main-query');
    expect(result.value.identifier.ranges).toEqual(inRange);
    expect(result.value.facets.find((f) => f.identifier.key === 'minPrice')?.stats).toEqual({ min: 100, max: 2000 });
    expect(result.value.facets.find((f) => f.identifier.key === 'maxPrice')?.stats).toEqual({ min: 300, max: 9000 });
  });

  it('keeps the ranges on the request of a multiselect facet, and the selection on the request of the bounds', async () => {
    searchRequests.responses = [
      response('main', { reviewBucket: { '4': 1 }, minPrice: { '2000': 1 } }),
      response('sibling', { reviewBucket: { '3': 2, '4': 1 } }, {}, 1),
      response('bounds', { minPrice: { '100': 1, '2000': 1 } }, { minPrice: stats(100, 2000) }, 1),
    ];

    await search().queryByTerm(query({ ranges: [{ facet: minPrice, max: 5000 }], facets: [bucket('4')], multiselect: [{ key: 'reviewBucket' }] }));

    expect(searchRequests.sent).toHaveLength(3);
    expect(searchRequests.sent[1]).toMatchObject({ facets: ['reviewBucket'], numericFilters: ['minPrice<=5000'], facetFilters: [] });
    expect(searchRequests.sent[2]).toMatchObject({ facets: ['minPrice'], facetFilters: [['reviewBucket:4']] });
    expect(searchRequests.sent[2]).not.toHaveProperty('numericFilters');
  });
  it('keeps the values and counts of the search for a ranged facet, and takes only the stats', async () => {
    searchRequests.responses = [
      response('main', { minPrice: { '2000': 1 } }, { minPrice: stats(2000, 2000) }),
      response('bounds', { minPrice: { '100': 4, '2000': 1 } }, { minPrice: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: [{ facet: minPrice, min: 1500 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = result.value.facets.find((f) => f.identifier.key === 'minPrice');
    expect(facet?.values.map((v) => [v.identifier.key, v.count])).toEqual([['2000', 1]]);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

  it('keeps the ranged facet, without values, when the range excludes every hit', async () => {
    searchRequests.responses = [
      response('main', {}),
      response('bounds', { minPrice: { '100': 4, '2000': 1 } }, { minPrice: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: [{ facet: minPrice, min: 99999 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets).toHaveLength(1);
    expect(result.value.facets[0]).toMatchObject({ identifier: { key: 'minPrice' }, values: [], stats: { min: 100, max: 2000 } });
  });

  it('gives a facet that is multiselect and ranged the values of its siblings and the stats of the bounds', async () => {
    const selected = { facet: minPrice, key: '2000' };
    searchRequests.responses = [
      response('main', { minPrice: { '2000': 1 } }, { minPrice: stats(2000, 2000) }),
      response('sibling', { minPrice: { '1500': 2, '2000': 1 } }, {}, 1),
      response('bounds', { minPrice: { '100': 4, '2000': 1 } }, { minPrice: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(
      query({ ranges: [{ facet: minPrice, min: 1500 }], facets: [selected], multiselect: [minPrice] }),
    );

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = result.value.facets.find((f) => f.identifier.key === 'minPrice');
    expect(facet?.values.map((v) => v.identifier.key)).toEqual(['1500', '2000']);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

});
