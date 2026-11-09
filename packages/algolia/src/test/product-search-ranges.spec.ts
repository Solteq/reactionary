import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { attributeFacet } from './facet-helpers.js';
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

const multiselect = ['color', 'weight'];

const search = () =>
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

const weight = { key: 'weight' };
const power = { key: 'power' };
const inRange = [
  { facet: power, min: 1000 },
  { facet: weight, max: 5000 },
];
const bucket = (key: string) => ({ facet: { key: 'color' }, key });

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
    expect(search().buildQuery(query({ ranges: inRange })).numericFilters).toEqual(['power>=1000', 'weight<=5000']);
  });

  it('sends both bounds of one range', () => {
    expect(search().buildQuery(query({ ranges: [{ facet: weight, min: 100, max: 900 }] })).numericFilters).toEqual([
      'weight>=100',
      'weight<=900',
    ]);
  });

  it('asks for the stats without the ranges, with one hit and no analytics', () => {
    const payload = query({ ranges: inRange, facets: [bucket('4')] });
    const sent = search().buildBounds(payload, ['power', 'weight']);

    expect(sent).toMatchObject({
      facets: ['power', 'weight'],
      hitsPerPage: 1,
      analytics: false,
      clickAnalytics: false,
      facetFilters: [['color:4']],
    });
    expect(sent).not.toHaveProperty('numericFilters');
  });

  it('puts the stats of the search on its facets', async () => {
    searchRequests.responses = [response('main', { weight: { '1000': 3 } }, { weight: stats(1000, 9000) })];

    const result = await search().queryByTerm(query({}));

    expect(searchRequests.sent).toHaveLength(1);
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(attributeFacet(result.value.facets, 'weight')?.stats).toEqual({ min: 1000, max: 9000 });
  });

  it('sends one request when a range has no bound', async () => {
    searchRequests.responses = [response('main', { weight: { '1000': 3 } })];

    await search().queryByTerm(query({ ranges: [{ facet: weight }] }));

    expect(searchRequests.sent).toHaveLength(1);
  });

  it('takes the stats of a ranged facet from the search without the ranges', async () => {
    searchRequests.responses = [
      response('main-query', { weight: { '2000': 1 }, power: { '3000': 1 } }, { weight: stats(2000, 2000), power: stats(3000, 3000) }),
      response('bounds-query', { weight: { '100': 4, '2000': 1 }, power: { '3000': 1, '9000': 2 } }, {
        weight: stats(100, 2000),
        power: stats(300, 9000),
      }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: inRange }));

    expect(searchRequests.sent).toHaveLength(2);
    expect(searchRequests.sent[0]).toMatchObject({ analytics: true, clickAnalytics: true, numericFilters: ['power>=1000', 'weight<=5000'] });
    expect(searchRequests.sent[1]).toMatchObject({ analytics: false, clickAnalytics: false, facets: ['power', 'weight'] });
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.identifier.key).toBe('main-query');
    expect(result.value.identifier.ranges).toEqual(inRange);
    expect(attributeFacet(result.value.facets, 'weight')?.stats).toEqual({ min: 100, max: 2000 });
    expect(attributeFacet(result.value.facets, 'power')?.stats).toEqual({ min: 300, max: 9000 });
  });

  it('keeps the ranges on the request of a multiselect facet, and the selection on the request of the bounds', async () => {
    searchRequests.responses = [
      response('main', { color: { '4': 1 }, weight: { '2000': 1 } }),
      response('sibling', { color: { '3': 2, '4': 1 } }, {}, 1),
      response('bounds', { weight: { '100': 1, '2000': 1 } }, { weight: stats(100, 2000) }, 1),
    ];

    await search().queryByTerm(query({ ranges: [{ facet: weight, max: 5000 }], facets: [bucket('4')] }));

    expect(searchRequests.sent).toHaveLength(3);
    expect(searchRequests.sent[1]).toMatchObject({ facets: ['color'], numericFilters: ['weight<=5000'], facetFilters: [] });
    expect(searchRequests.sent[2]).toMatchObject({ facets: ['weight'], facetFilters: [['color:4']] });
    expect(searchRequests.sent[2]).not.toHaveProperty('numericFilters');
  });
  it('keeps the values and counts of the search for a ranged facet, and takes only the stats', async () => {
    searchRequests.responses = [
      response('main', { weight: { '2000': 1 } }, { weight: stats(2000, 2000) }),
      response('bounds', { weight: { '100': 4, '2000': 1 } }, { weight: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: [{ facet: weight, min: 1500 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = attributeFacet(result.value.facets, 'weight');
    expect(facet?.values.map((v) => [v.identifier.key, v.count])).toEqual([['2000', 1]]);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

  it('keeps the ranged facet, without values, when the range excludes every hit', async () => {
    searchRequests.responses = [
      response('main', {}),
      response('bounds', { weight: { '100': 4, '2000': 1 } }, { weight: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(query({ ranges: [{ facet: weight, min: 99999 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets).toHaveLength(1);
    expect(result.value.facets[0]).toMatchObject({ identifier: { key: 'weight' }, values: [], stats: { min: 100, max: 2000 } });
  });

  it('gives a facet that is multiselect and ranged the values of its siblings and the stats of the bounds', async () => {
    const selected = { facet: weight, key: '2000' };
    searchRequests.responses = [
      response('main', { weight: { '2000': 1 } }, { weight: stats(2000, 2000) }),
      response('sibling', { weight: { '1500': 2, '2000': 1 } }, {}, 1),
      response('bounds', { weight: { '100': 4, '2000': 1 } }, { weight: stats(100, 2000) }, 1),
    ];

    const result = await search().queryByTerm(
      query({ ranges: [{ facet: weight, min: 1500 }], facets: [selected] }),
    );

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = attributeFacet(result.value.facets, 'weight');
    expect(facet?.values.map((v) => v.identifier.key)).toEqual(['1500', '2000']);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

});
