import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { ProductSearchQueryByTerm, ProductSearchResult } from '@reactionary/core';
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
}

const baseConfig = {
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
};

const capability = (facets?: Record<string, unknown>) =>
  new TestableProductSearchCapability(
    MeilisearchConfigurationSchema.parse({ ...baseConfig, ...(facets ? { facets } : {}) }),
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );

const query = (search: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  });

const concept = (key: string) => ({ key });

async function run(search: Record<string, unknown>, facets?: Record<string, unknown>) {
  const result = await capability(facets).queryByTerm(query(search));
  if (!result.success) {
    throw new Error('the search failed');
  }
  return result.value;
}

type ResultFacet = ProductSearchResult['facets'][number];

function ofSemantic<S extends ResultFacet['semantic']>(facets: ResultFacet[], semantic: S) {
  return facets.filter((facet): facet is Extract<ResultFacet, { semantic: S }> => facet.semantic === semantic);
}

describe('Meilisearch typed search filters', () => {
  beforeEach(() => {
    calls.sent = [];
    calls.responses = [];
  });

  describe('filter expressions', () => {
    it('ANDs every conceptContext concept on conceptIds', () => {
      const params = capability().buildSearchParams(query({ conceptContext: [concept('application/power-tools'), concept('features/cordless')] }));

      expect(params.filter).toBe('"conceptIds" = "application/power-tools" AND "conceptIds" = "features/cordless"');
    });

    it('ORs the concepts of a vocabulary in a group and ANDs the vocabularies', () => {
      const params = capability().buildSearchParams(
        query({ conceptFilter: [concept('features/cordless'), concept('power/battery'), concept('features/outdoor')] }),
      );

      expect(params.filter).toBe(
        '("conceptIds" = "features/cordless" OR "conceptIds" = "features/outdoor") AND ("conceptIds" = "power/battery")',
      );
    });

    it('escapes concept keys', () => {
      const params = capability().buildSearchParams(query({ conceptFilter: [concept('features/a" OR "b')] }));

      expect(String(params.filter).replace(/"(?:[^"\\]|\\.)*"/g, '""')).toBe('("" = "")');
    });

    it('converts the price range to minor units and tests the lowest and highest price of the product', () => {
      const params = capability().buildSearchParams(query({ priceFilter: { min: 10.5, max: 99.99 } }));

      expect(params.filter).toBe('"maxPrice" >= 1050 AND "minPrice" <= 9999');
    });

    it('sends one bound of the price range', () => {
      expect(capability().buildSearchParams(query({ priceFilter: { max: 20 } })).filter).toBe('"minPrice" <= 2000');
      expect(capability().buildSearchParams(query({ priceFilter: { min: 20 } })).filter).toBe('"maxPrice" >= 2000');
    });

    it('applies the rating range inclusive at both ends', () => {
      const params = capability().buildSearchParams(query({ ratingFilter: { min: 3, max: 4 } }));

      expect(params.filter).toBe('"reviewBucket" >= 3 AND "reviewBucket" <= 4');
    });

    it('ORs online and the stores', () => {
      const params = capability().buildSearchParams(query({ availabilityFilter: { online: true, stores: [{ key: 's1' }, { key: 's2' }] } }));

      expect(params.filter).toBe('("availableOnline" = true OR "availableStores" = "s1" OR "availableStores" = "s2")');
    });

    it('sends nothing for empty typed filters', () => {
      const params = capability().buildSearchParams(
        query({ conceptFilter: [], priceFilter: {}, ratingFilter: {}, availabilityFilter: { stores: [] } }),
      );

      expect(params.filter).toBeUndefined();
    });

    it('ANDs the typed filters with each other and the attribute facets', () => {
      const params = capability().buildSearchParams(
        query({
          facets: [{ facet: { key: 'manufacturer' }, key: 'Bosch' }],
          conceptContext: [concept('application/power-tools')],
          ratingFilter: { min: 4 },
          availabilityFilter: { online: true },
        }),
      );

      expect(params.filter).toBe(
        '"manufacturer"="Bosch" AND "conceptIds" = "application/power-tools" AND "reviewBucket" >= 4 AND ("availableOnline" = true)',
      );
    });

    it('uses the index fields of the configuration', () => {
      const params = capability({ fields: { rating: 'stars', priceMax: 'top' } }).buildSearchParams(
        query({ ratingFilter: { min: 4 }, priceFilter: { min: 1 } }),
      );

      expect(params.filter).toBe('"top" >= 100 AND "stars" >= 4');
    });
  });

  describe('refusing what it cannot apply', () => {
    it('refuses a facet on a field that belongs to a typed filter', async () => {
      const result = await capability().queryByTerm(query({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'InvalidInput' });
      }
      expect(calls.sent).toHaveLength(0);
    });
  });

  describe('requests', () => {
    const empty = { hits: [], facetDistribution: {}, estimatedTotalHits: 0 };

    it('searches once when there are no selections that hide siblings', async () => {
      calls.responses = [empty];

      await run({ conceptContext: [concept('a/b')], priceFilter: {} });

      expect(calls.sent).toHaveLength(1);
    });

    it('asks for the concepts of a vocabulary without its own selection only', async () => {
      calls.responses = [empty, empty, empty];

      await run({ conceptFilter: [concept('features/cordless'), concept('power/battery')] });

      expect(calls.sent).toHaveLength(3);
      expect(calls.sent[0].params).toMatchObject({ limit: 10, filter: '("conceptIds" = "features/cordless") AND ("conceptIds" = "power/battery")' });
      expect(calls.sent[1].params).toMatchObject({ limit: 0, offset: 0, facets: ['conceptFacets.features'], filter: '("conceptIds" = "power/battery")' });
      expect(calls.sent[2].params).toMatchObject({ limit: 0, facets: ['conceptFacets.power'], filter: '("conceptIds" = "features/cordless")' });
    });

    it('keeps the conceptContext in the sibling request of a vocabulary', async () => {
      calls.responses = [empty, empty];

      await run({ conceptContext: [concept('application/tools')], conceptFilter: [concept('features/cordless')] });

      expect(calls.sent[1].params).toMatchObject({ filter: '"conceptIds" = "application/tools"' });
    });

    it('asks for rating and availability without their own filter', async () => {
      calls.responses = [empty, empty, empty, empty];

      await run({ ratingFilter: { min: 4 }, availabilityFilter: { online: true }, priceFilter: { min: 5 } });

      // three requests more than the search itself: rating, availability and the price bounds
      expect(calls.sent).toHaveLength(4);
      const params = calls.sent.map((c) => c.params);
      expect(params[1]).toMatchObject({ facets: ['reviewBucket'], limit: 0, filter: '"maxPrice" >= 500 AND ("availableOnline" = true)' });
      expect(params[2]).toMatchObject({ facets: ['availableOnline', 'availableStores'], limit: 0, filter: '"maxPrice" >= 500 AND "reviewBucket" >= 4' });
      expect(params[3]).toMatchObject({ facets: ['minPrice', 'maxPrice'], limit: 0, filter: '"reviewBucket" >= 4 AND ("availableOnline" = true)' });
    });
  });

  describe('facets', () => {
    const body = {
      hits: [],
      estimatedTotalHits: 5,
      facetDistribution: {
        manufacturer: { Bosch: 3 },
        'conceptFacets.features': { 'features/cordless|Cordless': 3, 'features/a|b|c': 1, 'features/plain': 2 },
        reviewBucket: { '3': 1, '5': 2, '4': 4 },
        availableOnline: { true: 4, false: 1 },
        availableStores: { s1: 2 },
        minPrice: { '1000': 1 },
        maxPrice: { '5000': 1 },
        conceptIds: { 'features/cordless': 3 },
        'concepts.features': { Cordless: 3 },
        flags: { x: 1 },
      },
      facetStats: { minPrice: { min: 1250, max: 3000 }, maxPrice: { min: 2000, max: 8999 }, reviewBucket: { min: 3, max: 5 } },
    };

    it('maps the engine facets to the union and drops hidden fields', async () => {
      calls.responses = [body];

      const result = await run({});

      expect(result.facets.map((f) => f.semantic)).toEqual(['attribute', 'taxonomy', 'price', 'rating', 'availability']);
      const [attribute] = ofSemantic(result.facets, 'attribute');
      expect(attribute).toMatchObject({ identifier: { key: 'manufacturer' }, multiselect: false });
    });

    it('splits taxonomy values on the first bar and names the vocabulary', async () => {
      calls.responses = [body];

      const [facet] = ofSemantic((await run({})).facets, 'taxonomy');

      expect(facet).toMatchObject({ vocabulary: 'features', name: 'Features', multiselect: true });
      expect(facet.values).toEqual([
        { concept: { key: 'features/cordless' }, name: 'Cordless', count: 3, active: false },
        { concept: { key: 'features/a' }, name: 'b|c', count: 1, active: false },
        { concept: { key: 'features/plain' }, name: 'plain', count: 2, active: false },
      ]);
    });

    it('turns the stats of the price fields into decimal amounts', async () => {
      calls.responses = [body];

      const [facet] = ofSemantic((await run({})).facets, 'price');

      expect(facet).toMatchObject({ name: 'Price', currency: 'DKK', stats: { min: 12.5, max: 89.99 } });
      expect(facet).not.toHaveProperty('selected');
    });

    it('makes one rating bucket per star, the highest first', async () => {
      calls.responses = [body];

      const [facet] = ofSemantic((await run({})).facets, 'rating');

      expect(facet.name).toBe('Rating');
      expect(facet.buckets).toEqual([
        { min: 5, max: 5, count: 2, active: false },
        { min: 4, max: 4, count: 4, active: false },
        { min: 3, max: 3, count: 1, active: false },
      ]);
    });

    it('has online only with a count for true', async () => {
      calls.responses = [body];
      const [facet] = ofSemantic((await run({})).facets, 'availability');
      expect(facet).toMatchObject({ name: 'Availability', online: { count: 4, active: false }, stores: [{ store: { key: 's1' }, count: 2, active: false }] });

      calls.sent = [];
      calls.responses = [{ ...body, facetDistribution: { availableOnline: { false: 3 }, availableStores: { s1: 2 } } }];
      const [without] = ofSemantic((await run({})).facets, 'availability');
      expect(without.online).toBeUndefined();
    });

    it('names typed facets by the policy and orders them', async () => {
      calls.responses = [body];

      const result = await run({}, { names: { price: 'Cost', 'conceptFacets.features': 'Highlights' }, order: ['rating', 'taxonomy:features', 'price'] });

      expect(result.facets.map((f) => [f.semantic, f.name])).toEqual([
        ['rating', 'Rating'],
        ['taxonomy', 'Highlights'],
        ['price', 'Cost'],
      ]);
    });

    it('marks multiselect attribute facets from the policy', async () => {
      calls.responses = [body];

      const [facet] = ofSemantic((await run({}, { multiselect: ['manufacturer'] })).facets, 'attribute');

      expect(facet.multiselect).toBe(true);
    });

    it('echoes the typed filters in the identifier', async () => {
      calls.responses = [body, body, body, body, body];

      const result = await run({
        conceptContext: [concept('a/b')],
        conceptFilter: [concept('features/cordless')],
        priceFilter: { min: 5 },
        ratingFilter: { min: 4 },
        availabilityFilter: { online: true },
      });

      expect(result.identifier).toMatchObject({
        conceptContext: [{ key: 'a/b' }],
        conceptFilter: [{ key: 'features/cordless' }],
        priceFilter: { min: 5 },
        ratingFilter: { min: 4 },
        availabilityFilter: { online: true },
      });
      expect(result.identifier).not.toHaveProperty('multiselect');
    });

    it('marks the selected values active and keeps the siblings of the selection', async () => {
      const selected = { ...body, facetDistribution: { 'conceptFacets.features': { 'features/cordless|Cordless': 1 }, reviewBucket: { '4': 1 }, availableOnline: { true: 1 }, availableStores: { s1: 1 }, minPrice: { '1000': 1 }, maxPrice: { '2000': 1 } }, facetStats: { minPrice: { min: 1000, max: 1000 }, maxPrice: { min: 2000, max: 2000 } } };
      calls.responses = [selected, body, body, body, body];

      const result = await run({
        conceptFilter: [concept('features/cordless')],
        ratingFilter: { min: 4, max: 5 },
        availabilityFilter: { online: true, stores: [{ key: 's1' }] },
        priceFilter: { min: 10, max: 20 },
      });

      expect(calls.sent).toHaveLength(5);
      const [taxonomy] = ofSemantic(result.facets, 'taxonomy');
      expect(taxonomy.values.map((v) => [v.concept.key, v.active])).toEqual([
        ['features/cordless', true],
        ['features/a', false],
        ['features/plain', false],
      ]);
      const [rating] = ofSemantic(result.facets, 'rating');
      expect(rating.buckets.map((b) => [b.min, b.active])).toEqual([[5, true], [4, true], [3, false]]);
      const [availability] = ofSemantic(result.facets, 'availability');
      expect(availability.online?.active).toBe(true);
      expect(availability.stores[0].active).toBe(true);
      const [price] = ofSemantic(result.facets, 'price');
      // the bounds are those of the search without its priceFilter, the selection is echoed
      expect(price).toMatchObject({ stats: { min: 12.5, max: 89.99 }, selected: { min: 10, max: 20 } });
    });
  });

  describe('categories', () => {
    it('still remaps the hierarchy to the categories facet, which is never multiselect', async () => {
      calls.responses = [
        {
          hits: [],
          estimatedTotalHits: 0,
          facetDistribution: { 'hierarchy.lvl0': { Tools: 3 }, 'hierarchy.lvl1': { 'Tools > Drills': 1 } },
        },
      ];

      const result = await run({}, { multiselect: ['categories', 'hierarchy.lvl0'] });

      const [facet] = ofSemantic(result.facets, 'attribute');
      expect(result.facets).toHaveLength(1);
      expect(facet).toMatchObject({ identifier: { key: 'categories' }, name: 'Categories', multiselect: false });
      expect(facet.values.map((v) => v.name)).toEqual(['Tools']);
    });
  });
});
