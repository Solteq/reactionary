import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
  attributeFacetId,
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
    // `key` is the key of an attribute facet, or the id of another kind
    const group = this.siblingGroupsOf(payload).find((g) => g.ids.includes(key) || g.ids.includes(attributeFacetId(key)));
    if (!group) {
      throw new Error('no sibling group');
    }
    return this.siblingFacetPayload(group);
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const capability = (multiselect: string[] = []) =>
  new TestableProductSearchCapability(
    MeilisearchConfigurationSchema.parse({ ...config, facets: { multiselect } }),
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );

const query = (search: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  });

const bucket = (key: string) => ({ facet: { key: 'color' }, key });
const brand = (key: string) => ({ facet: { key: 'manufacturer' }, key });

describe('Meilisearch multiselect facets', () => {
  beforeEach(() => {
    calls.sent = [];
    calls.responses = [];
  });

  it('ANDs every selected value, as before, without multiselect', () => {
    const params = capability().buildSearchParams(query({ facets: [bucket('4'), bucket('5'), brand('Bosch')] }));

    expect(params.filter).toBe('"color"="4" AND "color"="5" AND "manufacturer"="Bosch"');
  });

  it('ORs the values of a multiselect facet of the policy in a group and ANDs the rest', () => {
    const params = capability(['color']).buildSearchParams(query({ facets: [bucket('4'), brand('Bosch'), bucket('5')] }));

    expect(params.filter).toBe('"manufacturer"="Bosch" AND ("color"="4" OR "color"="5")');
  });

  it('never makes the categories facet multiselect', () => {
    const categories = { facet: { key: 'categories' }, key: 'Tools' };
    const params = capability(['categories']).buildSearchParams(query({ facets: [categories] }));

    expect(params.filter).toBe('categories = "Tools"');
  });

  it('escapes the values of a multiselect facet', () => {
    const params = capability(['manufacturer']).buildSearchParams(query({ facets: [brand('A" OR "x"="y'), brand('B')] }));

    expect(String(params.filter).replace(/"(?:[^"\\]|\\.)*"/g, '""')).toBe('(""="" OR ""="")');
  });

  it('asks for the siblings without the selection and without hits', () => {
    const payload = query({ facets: [bucket('4'), brand('Bosch')] });
    const params = capability(['color']).buildSibling(payload, 'color');

    expect(params).toMatchObject({ facets: ['color'], limit: 0, offset: 0, filter: '"manufacturer"="Bosch"' });
  });

  it('searches once when no multiselect facet has a value selected', async () => {
    calls.responses = [{ hits: [], facetDistribution: { color: { '4': 3 } }, estimatedTotalHits: 0 }];

    await capability(['color']).queryByTerm(query({}));

    expect(calls.sent).toHaveLength(1);
  });

  it('takes the siblings of a multiselect facet from a search without its selection', async () => {
    calls.responses = [
      { hits: [], facetDistribution: { color: { '4': 3 }, manufacturer: { Bosch: 3 } }, estimatedTotalHits: 3 },
      { hits: [], facetDistribution: { color: { '3': 2, '4': 3, '5': 1 } }, estimatedTotalHits: 6 },
    ];

    const result = await capability(['color']).queryByTerm(query({ facets: [bucket('4')] }));

    expect(calls.sent).toHaveLength(2);
    expect(calls.sent[0].params).toMatchObject({ limit: 10, filter: '("color"="4")' });
    expect(calls.sent[1].params).toMatchObject({ limit: 0, facets: ['color'] });
    expect(calls.sent[1].params).toMatchObject({ filter: undefined });
    if (!result.success) {
      throw new Error('the search failed');
    }
    expect(result.value.totalCount).toBe(3);
    expect(result.value.identifier).not.toHaveProperty('multiselect');
    expect(result.value.facets.map((f) => f.semantic === 'attribute' && f.identifier.key)).toEqual(['color', 'manufacturer']);
    const colors = result.value.facets.find((f) => f.semantic === 'attribute' && f.identifier.key === 'color');
    expect(colors).toMatchObject({ multiselect: true });
    expect(colors?.semantic === 'attribute' && colors.values.map((v) => [v.identifier.key, v.count, v.active])).toEqual([
      ['3', 2, false],
      ['4', 3, true],
      ['5', 1, false],
    ]);
    const manufacturer = result.value.facets.find((f) => f.semantic === 'attribute' && f.identifier.key === 'manufacturer');
    expect(manufacturer).toMatchObject({ multiselect: false });
  });
});
