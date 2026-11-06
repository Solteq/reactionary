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

  public buildSibling(payload: ProductSearchQueryByTerm, key: string) {
    return this.siblingFacetPayload(payload, key);
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

const bucket = (key: string) => ({ facet: { key: 'reviewBucket' }, key });
const brand = (key: string) => ({ facet: { key: 'manufacturer' }, key });

describe('Meilisearch multiselect facets', () => {
  beforeEach(() => {
    calls.sent = [];
    calls.responses = [];
  });

  it('ANDs every selected value, as before, without multiselect', () => {
    const params = capability().buildSearchParams(query({ facets: [bucket('4'), bucket('5'), brand('Bosch')] }));

    expect(params.filter).toBe('"reviewBucket"="4" AND "reviewBucket"="5" AND "manufacturer"="Bosch"');
  });

  it('ORs the values of a multiselect facet in a group and ANDs the rest', () => {
    const params = capability().buildSearchParams(
      query({ facets: [bucket('4'), brand('Bosch'), bucket('5')], multiselect: [{ key: 'reviewBucket' }] }),
    );

    expect(params.filter).toBe('"manufacturer"="Bosch" AND ("reviewBucket"="4" OR "reviewBucket"="5")');
  });

  it('escapes the values of a multiselect facet', () => {
    const params = capability().buildSearchParams(
      query({ facets: [brand('A" OR "x"="y'), brand('B')], multiselect: [{ key: 'manufacturer' }] }),
    );

    expect(String(params.filter).replace(/"(?:[^"\\]|\\.)*"/g, '""')).toBe('(""="" OR ""="")');
  });

  it('asks for the siblings without the selection and without hits', () => {
    const payload = query({ facets: [bucket('4'), brand('Bosch')], multiselect: [{ key: 'reviewBucket' }] });
    const params = capability().buildSibling(payload, 'reviewBucket');

    expect(params).toMatchObject({ facets: ['reviewBucket'], limit: 0, offset: 0, filter: '"manufacturer"="Bosch"' });
  });

  it('searches once when no multiselect facet has a value selected', async () => {
    calls.responses = [{ hits: [], facetDistribution: { reviewBucket: { '4': 3 } }, estimatedTotalHits: 0 }];

    await capability().queryByTerm(query({ multiselect: [{ key: 'reviewBucket' }] }));

    expect(calls.sent).toHaveLength(1);
  });

  it('takes the siblings of a multiselect facet from a search without its selection', async () => {
    calls.responses = [
      { hits: [], facetDistribution: { reviewBucket: { '4': 3 }, manufacturer: { Bosch: 3 } }, estimatedTotalHits: 3 },
      { hits: [], facetDistribution: { reviewBucket: { '3': 2, '4': 3, '5': 1 } }, estimatedTotalHits: 6 },
    ];

    const result = await capability().queryByTerm(query({ facets: [bucket('4')], multiselect: [{ key: 'reviewBucket' }] }));

    expect(calls.sent).toHaveLength(2);
    expect(calls.sent[0].params).toMatchObject({ limit: 10, filter: '("reviewBucket"="4")' });
    expect(calls.sent[1].params).toMatchObject({ limit: 0, facets: ['reviewBucket'] });
    expect(calls.sent[1].params).toMatchObject({ filter: undefined });
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.totalCount).toBe(3);
    expect(result.value.identifier.multiselect).toEqual([{ key: 'reviewBucket' }]);
    expect(result.value.facets.map((f) => f.identifier.key)).toEqual(['reviewBucket', 'manufacturer']);
    const reviews = result.value.facets.find((f) => f.identifier.key === 'reviewBucket');
    expect(reviews?.values.map((v) => [v.identifier.key, v.count, v.active])).toEqual([
      ['3', 2, false],
      ['4', 3, true],
      ['5', 1, false],
    ]);
  });
});
