import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { ProductSearchQueryByTerm } from '@reactionary/core';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

const calls = vi.hoisted(() => ({
  sent: [] as { term: string; params: unknown }[],
  responses: [] as unknown[],
}));

vi.mock('meilisearch', () => ({
  Meilisearch: class {
    index() {
      return {
        search: async (term: string, params: unknown) => {
          calls.sent.push({ term, params });
          return calls.responses[calls.sent.length - 1];
        },
      };
    }
  },
}));

class TestableProductSearchCapability extends MeilisearchProductSearchCapability {
  public buildSearchParams(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }

  public buildBounds(payload: ProductSearchQueryByTerm, keys: string[]) {
    return this.rangeBoundsPayload(payload, keys);
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const capability = () =>
  new TestableProductSearchCapability(
    config,
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );

const query = (search: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  });

const minPrice = { key: 'minPrice' };
const maxPrice = { key: 'maxPrice' };
const inRange = [
  { facet: maxPrice, min: 1000 },
  { facet: minPrice, max: 5000 },
];
const bucket = (key: string) => ({ facet: { key: 'reviewBucket' }, key });

describe('Meilisearch range filters', () => {
  beforeEach(() => {
    calls.sent = [];
    calls.responses = [];
  });

  it('sends no filter for ranges without ranges', () => {
    expect(capability().buildSearchParams(query({})).filter).toBeUndefined();
  });

  it('sends every bound as a comparison, ANDed with the rest', () => {
    const params = capability().buildSearchParams(query({ ranges: inRange, facets: [bucket('4')] }));

    expect(params.filter).toBe('"reviewBucket"="4" AND "maxPrice" >= 1000 AND "minPrice" <= 5000');
  });

  it('sends both bounds of one range', () => {
    const params = capability().buildSearchParams(query({ ranges: [{ facet: minPrice, min: 100, max: 900.5 }] }));

    expect(params.filter).toBe('"minPrice" >= 100 AND "minPrice" <= 900.5');
  });

  it('escapes the name of the facet', () => {
    const params = capability().buildSearchParams(query({ ranges: [{ facet: { key: 'a" OR "b' }, min: 1 }] }));

    expect(String(params.filter).replace(/"(?:[^"\\]|\\.)*"/g, '""')).toBe('"" >= 1');
  });

  it('asks for the stats without the ranges and without hits', () => {
    const params = capability().buildBounds(query({ ranges: inRange, facets: [bucket('4')] }), ['maxPrice', 'minPrice']);

    expect(params).toMatchObject({ facets: ['maxPrice', 'minPrice'], limit: 0, offset: 0, filter: '"reviewBucket"="4"' });
  });

  it('puts the stats of the search on its facets', async () => {
    calls.responses = [
      { hits: [], facetDistribution: { minPrice: { '1000': 3 } }, facetStats: { minPrice: { min: 1000, max: 9000 } }, estimatedTotalHits: 3 },
    ];

    const result = await capability().queryByTerm(query({}));

    expect(calls.sent).toHaveLength(1);
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets[0].stats).toEqual({ min: 1000, max: 9000 });
  });

  it('searches once when a range has no bound', async () => {
    calls.responses = [{ hits: [], facetDistribution: { minPrice: { '1000': 3 } }, estimatedTotalHits: 3 }];

    await capability().queryByTerm(query({ ranges: [{ facet: minPrice }] }));

    expect(calls.sent).toHaveLength(1);
  });

  it('takes the stats of a ranged facet from the search without the ranges', async () => {
    calls.responses = [
      {
        hits: [],
        facetDistribution: { minPrice: { '2000': 1 }, maxPrice: { '3000': 1 } },
        facetStats: { minPrice: { min: 2000, max: 2000 }, maxPrice: { min: 3000, max: 3000 } },
        estimatedTotalHits: 1,
      },
      {
        hits: [],
        facetDistribution: { minPrice: { '100': 4, '2000': 1 }, maxPrice: { '3000': 1, '9000': 2 } },
        facetStats: { minPrice: { min: 100, max: 2000 }, maxPrice: { min: 300, max: 9000 } },
        estimatedTotalHits: 5,
      },
    ];

    const result = await capability().queryByTerm(query({ ranges: inRange }));

    expect(calls.sent).toHaveLength(2);
    expect(calls.sent[0].params).toMatchObject({ limit: 10, filter: '"maxPrice" >= 1000 AND "minPrice" <= 5000' });
    expect(calls.sent[1].params).toMatchObject({ limit: 0, facets: ['maxPrice', 'minPrice'] });
    expect(calls.sent[1].params).toMatchObject({ filter: undefined });
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.totalCount).toBe(1);
    expect(result.value.identifier.ranges).toEqual(inRange);
    expect(result.value.facets.find((f) => f.identifier.key === 'minPrice')?.stats).toEqual({ min: 100, max: 2000 });
    expect(result.value.facets.find((f) => f.identifier.key === 'maxPrice')?.stats).toEqual({ min: 300, max: 9000 });
  });
  it('keeps the values and counts of the search for a ranged facet, and takes only the stats', async () => {
    calls.responses = [
      { hits: [], facetDistribution: { minPrice: { '2000': 1 } }, facetStats: { minPrice: { min: 2000, max: 2000 } }, estimatedTotalHits: 1 },
      { hits: [], facetDistribution: { minPrice: { '100': 4, '2000': 1 } }, facetStats: { minPrice: { min: 100, max: 2000 } }, estimatedTotalHits: 5 },
    ];

    const result = await capability().queryByTerm(query({ ranges: [{ facet: minPrice, min: 1500 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = result.value.facets.find((f) => f.identifier.key === 'minPrice');
    expect(facet?.values.map((v) => [v.identifier.key, v.count])).toEqual([['2000', 1]]);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

  it('keeps the ranged facet, without values, when the range excludes every hit', async () => {
    calls.responses = [
      { hits: [], facetDistribution: {}, estimatedTotalHits: 0 },
      { hits: [], facetDistribution: { minPrice: { '100': 4, '2000': 1 } }, facetStats: { minPrice: { min: 100, max: 2000 } }, estimatedTotalHits: 5 },
    ];

    const result = await capability().queryByTerm(query({ ranges: [{ facet: minPrice, min: 99999 }] }));

    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets).toHaveLength(1);
    expect(result.value.facets[0]).toMatchObject({ identifier: { key: 'minPrice' }, values: [], stats: { min: 100, max: 2000 } });
  });

  it('gives a facet that is multiselect and ranged the values of its siblings and the stats of the bounds', async () => {
    calls.responses = [
      { hits: [], facetDistribution: { minPrice: { '2000': 1 } }, facetStats: { minPrice: { min: 2000, max: 2000 } }, estimatedTotalHits: 1 },
      { hits: [], facetDistribution: { minPrice: { '1500': 2, '2000': 1 } }, estimatedTotalHits: 3 },
      { hits: [], facetDistribution: { minPrice: { '100': 4, '2000': 1 } }, facetStats: { minPrice: { min: 100, max: 2000 } }, estimatedTotalHits: 5 },
    ];

    const result = await capability().queryByTerm(
      query({ ranges: [{ facet: minPrice, min: 1500 }], facets: [{ facet: minPrice, key: '2000' }], multiselect: [minPrice] }),
    );

    if (!result.success) {
      throw new Error('the search failed');
    }
    const facet = result.value.facets.find((f) => f.identifier.key === 'minPrice');
    expect(facet?.values.map((v) => v.identifier.key)).toEqual(['1500', '2000']);
    expect(facet?.stats).toEqual({ min: 100, max: 2000 });
  });

  it('ignores stats that are not numbers', async () => {
    calls.responses = [{ hits: [], facetDistribution: { minPrice: { '1000': 3 } }, facetStats: { minPrice: {} }, estimatedTotalHits: 3 }];

    const result = await capability().queryByTerm(query({}));

    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.facets[0]).not.toHaveProperty('stats');
  });

});
