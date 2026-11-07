import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
} from '@reactionary/core';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaConfigurationSchema } from '../schema/configuration.schema.js';
import {
  attributeFacets,
  availabilityFacet,
  priceFacet,
  ratingFacet,
  taxonomyFacets,
} from './facet-helpers.js';

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
}

const search = (facets?: Record<string, unknown>) =>
  new TestableSearch(
    new NoOpCache(),
    createInitialRequestContext(),
    AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products', facets }),
    new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, facets),
  );

const query = (extra: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...extra },
  });

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

async function run(extra: Record<string, unknown>, facets?: Record<string, unknown>): Promise<ProductSearchResult> {
  const result = await search(facets).queryByTerm(query(extra));
  if (!result.success) {
    throw new Error(`the search failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

describe('Algolia typed filters', () => {
  beforeEach(() => {
    searchRequests.sent = [];
    searchRequests.responses = [];
  });

  describe('request building', () => {
    it('sends no filters for a search without them', () => {
      const sent = search().buildQuery(query({}));
      expect(sent.facetFilters).toEqual([]);
      expect(sent).not.toHaveProperty('numericFilters');
    });

    it('makes every concept of the context an entry of its own', () => {
      const sent = search().buildQuery(query({ conceptContext: [{ key: 'features/cordless' }, { key: 'category/drills' }] }));
      expect(sent.facetFilters).toEqual(['conceptIds:features/cordless', 'conceptIds:category/drills']);
    });

    it('ORs the concepts of a vocabulary and ANDs the vocabularies', () => {
      const sent = search().buildQuery(
        query({
          conceptFilter: [{ key: 'features/cordless' }, { key: 'power-source/battery' }, { key: 'features/outdoor' }],
        }),
      );
      expect(sent.facetFilters).toEqual([
        ['conceptIds:features/cordless', 'conceptIds:features/outdoor'],
        ['conceptIds:power-source/battery'],
      ]);
    });

    it('uses the concept field of the configuration', () => {
      const sent = search({ fields: { conceptIds: 'ids' } }).buildQuery(query({ conceptContext: [{ key: 'a/b' }] }));
      expect(sent.facetFilters).toEqual(['ids:a/b']);
    });

    it('ANDs the concept filters with the attribute facets', () => {
      const sent = search().buildQuery(
        query({ facets: [{ facet: { key: 'brand' }, key: 'Bosch' }], conceptFilter: [{ key: 'features/cordless' }] }),
      );
      expect(sent.facetFilters).toEqual(['brand:Bosch', ['conceptIds:features/cordless']]);
    });

    it('ORs online and the stores of the availability in one nested array', () => {
      const sent = search().buildQuery(query({ availabilityFilter: { online: true, stores: [{ key: 's1' }, { key: 's2' }] } }));
      expect(sent.facetFilters).toEqual([['availableOnline:true', 'availableStores:s1', 'availableStores:s2']]);
    });

    it('does not filter on online when it is false', () => {
      const sent = search().buildQuery(query({ availabilityFilter: { online: false, stores: [{ key: 's1' }] } }));
      expect(sent.facetFilters).toEqual([['availableStores:s1']]);
    });

    it('converts the price range to minor units and applies it as an overlap', () => {
      const sent = search().buildQuery(query({ priceFilter: { min: 12.5, max: 99.99 } }));
      expect(sent.numericFilters).toEqual(['maxPrice>=1250', 'minPrice<=9999']);
    });

    it('applies one open end of the price', () => {
      expect(search().buildQuery(query({ priceFilter: { min: 10 } })).numericFilters).toEqual(['maxPrice>=1000']);
      expect(search().buildQuery(query({ priceFilter: { max: 10 } })).numericFilters).toEqual(['minPrice<=1000']);
    });

    it('converts with the fraction digits of the currency of the request', () => {
      const context = createInitialRequestContext();
      context.languageContext.currencyCode = 'JPY';
      const capability = new TestableSearch(
        new NoOpCache(),
        context,
        AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products' }),
        new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema),
      );
      expect(capability.buildQuery(query({ priceFilter: { min: 500 } })).numericFilters).toEqual(['maxPrice>=500']);
    });

    it('applies both ends of the rating inclusively', () => {
      const sent = search().buildQuery(query({ ratingFilter: { min: 1, max: 2 } }));
      expect(sent.numericFilters).toEqual(['reviewBucket>=1', 'reviewBucket<=2']);
    });

    it('applies a rating of zero stars', () => {
      expect(search().buildQuery(query({ ratingFilter: { min: 0, max: 0 } })).numericFilters).toEqual([
        'reviewBucket>=0',
        'reviewBucket<=0',
      ]);
    });

    it('uses the fields of the configuration for price and rating', () => {
      const sent = search({ fields: { priceMin: 'lo', priceMax: 'hi', rating: 'stars' } }).buildQuery(
        query({ priceFilter: { min: 1, max: 2 }, ratingFilter: { min: 4 } }),
      );
      expect(sent.numericFilters).toEqual(['hi>=100', 'lo<=200', 'stars>=4']);
    });

    it('ORs the values of a multiselect attribute of the policy', () => {
      const sent = search({ multiselect: ['color'] }).buildQuery(
        query({
          facets: [
            { facet: { key: 'color' }, key: 'red' },
            { facet: { key: 'brand' }, key: 'Bosch' },
            { facet: { key: 'color' }, key: 'blue' },
          ],
        }),
      );
      expect(sent.facetFilters).toEqual(['brand:Bosch', ['color:red', 'color:blue']]);
    });

    it('keeps the categories facet as a filter, never multiselect', () => {
      const sent = search({ multiselect: ['categories'] }).buildQuery(
        query({ facets: [{ facet: { key: 'categories' }, key: 'Tools' }] }),
      );
      expect(sent.facetFilters).toEqual([]);
      expect(sent.filters).toBe('categories:"Tools"');
    });
  });

  describe('refusing', () => {
    it('refuses a facet that belongs to a typed filter', async () => {
      const result = await search().queryByTerm(query({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'InvalidInput' });
      }
      expect(searchRequests.sent).toHaveLength(0);
    });

    it('refuses a range on the price field', async () => {
      const result = await search().queryByTerm(query({ ranges: [{ facet: { key: 'minPrice' }, min: 1 }] }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'InvalidInput' });
      }
    });

    it('does not refuse the typed filters it supports', async () => {
      searchRequests.responses = [response('main', {}), response('x', {}, {}, 1), response('y', {}, {}, 1), response('z', {}, {}, 1)];
      const result = await search().queryByTerm(
        query({ conceptContext: [{ key: 'a/b' }], priceFilter: { min: 1 }, ratingFilter: { min: 1 } , availabilityFilter: { online: true } }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('requests that keep the other values visible', () => {
    it('sends one request when none of the typed filters is set', async () => {
      searchRequests.responses = [response('main', {})];
      await run({});
      expect(searchRequests.sent).toHaveLength(1);
    });

    it('sends one request for a context, as it does not hide anything the shopper can undo', async () => {
      searchRequests.responses = [response('main', {})];
      await run({ conceptContext: [{ key: 'a/b' }] });
      expect(searchRequests.sent).toHaveLength(1);
    });

    it('asks once for each vocabulary that has a concept selected, keeping the other filters', async () => {
      searchRequests.responses = [
        response('main', { 'conceptFacets.features': { 'features/cordless|Cordless': 1 } }),
        response('features', { 'conceptFacets.features': { 'features/cordless|Cordless': 1, 'features/outdoor|Outdoor': 4 } }, {}, 1),
        response('power', { 'conceptFacets.power-source': { 'power-source/battery|Battery': 2 } }, {}, 1),
        response('rating', {}, {}, 1),
      ];

      const result = await run({
        conceptFilter: [{ key: 'features/cordless' }, { key: 'power-source/battery' }],
        ratingFilter: { min: 3 },
      });

      expect(searchRequests.sent).toHaveLength(4);
      expect(searchRequests.sent[0]).toMatchObject({ analytics: true, clickAnalytics: true });
      expect(searchRequests.sent[1]).toMatchObject({
        facets: ['conceptFacets.features'],
        facetFilters: [['conceptIds:power-source/battery']],
        numericFilters: ['reviewBucket>=3'],
        analytics: false,
        hitsPerPage: 1,
      });
      expect(searchRequests.sent[2]).toMatchObject({
        facets: ['conceptFacets.power-source'],
        facetFilters: [['conceptIds:features/cordless']],
      });
      expect(result.identifier).toMatchObject({ key: 'main' });
      const features = taxonomyFacets(result.facets).find((f) => f.vocabulary === 'features');
      expect(features?.values.map((v) => [v.concept.key, v.name, v.count, v.active])).toEqual([
        ['features/cordless', 'Cordless', 1, true],
        ['features/outdoor', 'Outdoor', 4, false],
      ]);
    });

    it('asks for the rating without the ratingFilter and keeps every bucket', async () => {
      searchRequests.responses = [
        response('main', { reviewBucket: { '4': 2 } }),
        response('rating', { reviewBucket: { '2': 1, '4': 2, '5': 7 } }, {}, 1),
        response('bounds', {}, {}, 1),
      ];

      const result = await run({ ratingFilter: { min: 4, max: 4 }, priceFilter: { max: 10 } });

      expect(searchRequests.sent[1]).toMatchObject({ facets: ['reviewBucket'], numericFilters: ['minPrice<=1000'] });
      expect(searchRequests.sent[1]).not.toMatchObject({ numericFilters: expect.arrayContaining(['reviewBucket>=4']) });
      expect(ratingFacet(result.facets)?.buckets).toEqual([
        { min: 5, max: 5, count: 7, active: false },
        { min: 4, max: 4, count: 2, active: true },
        { min: 2, max: 2, count: 1, active: false },
      ]);
    });

    it('asks for the availability without the availabilityFilter', async () => {
      searchRequests.responses = [
        response('main', { availableOnline: { true: 1 } }),
        response('availability', { availableOnline: { true: 5, false: 3 }, availableStores: { s1: 2, s2: 4 } }, {}, 1),
      ];

      const result = await run({ availabilityFilter: { stores: [{ key: 's2' }] }, conceptContext: [{ key: 'a/b' }] });

      expect(searchRequests.sent).toHaveLength(2);
      expect(searchRequests.sent[1]).toMatchObject({
        facets: ['availableOnline', 'availableStores'],
        facetFilters: ['conceptIds:a/b'],
      });
      expect(availabilityFacet(result.facets)).toMatchObject({
        online: { count: 5, active: false },
        stores: [
          { store: { key: 's1' }, count: 2, active: false },
          { store: { key: 's2' }, count: 4, active: true },
        ],
      });
    });

    it('takes the price stats from the search without the priceFilter, and nothing else', async () => {
      searchRequests.responses = [
        response('main', { minPrice: { '2000': 1 } }, { minPrice: stats(2000, 2000), maxPrice: stats(3000, 3000) }),
        response('rating', {}, {}, 1),
        response('bounds', {}, { minPrice: stats(100, 2000), maxPrice: stats(300, 9000) }, 1),
      ];

      const result = await run({ priceFilter: { min: 15, max: 40 }, ratingFilter: { min: 3 } });

      expect(searchRequests.sent).toHaveLength(3);
      expect(searchRequests.sent[2]).toMatchObject({
        facets: ['minPrice', 'maxPrice'],
        numericFilters: ['reviewBucket>=3'],
        analytics: false,
      });
      expect(searchRequests.sent[2]).not.toMatchObject({ numericFilters: expect.arrayContaining(['maxPrice>=1500']) });
      expect(priceFacet(result.facets)).toMatchObject({
        currency: createInitialRequestContext().languageContext.currencyCode,
        stats: { min: 1, max: 90 },
        selected: { min: 15, max: 40 },
      });
    });

    it('keeps the price facet when the filter excludes every product', async () => {
      searchRequests.responses = [response('main', {}), response('bounds', {}, { minPrice: stats(100, 2000), maxPrice: stats(300, 9000) }, 1)];

      const result = await run({ priceFilter: { min: 1000 } });

      expect(priceFacet(result.facets)).toMatchObject({ stats: { min: 1, max: 90 }, selected: { min: 1000 } });
    });

    it('sends one request for the price without a priceFilter', async () => {
      searchRequests.responses = [response('main', {}, { minPrice: stats(100, 200), maxPrice: stats(300, 900) })];

      const result = await run({});

      expect(searchRequests.sent).toHaveLength(1);
      expect(priceFacet(result.facets)?.selected).toBeUndefined();
    });

    it('keeps the extra requests apart, one each, in parallel with the main one', async () => {
      searchRequests.responses = [
        response('main', {}),
        response('a', {}, {}, 1),
        response('b', {}, {}, 1),
        response('c', {}, {}, 1),
        response('d', {}, {}, 1),
      ];

      await run({
        conceptFilter: [{ key: 'features/cordless' }],
        ratingFilter: { min: 1 },
        availabilityFilter: { online: true },
        priceFilter: { min: 1 },
      });

      expect(searchRequests.sent).toHaveLength(5);
    });
  });

  describe('facet mapping', () => {
    const body = response(
      'main',
      {
        brand: { Acme: 4 },
        flags: { ageRestricted: 1 },
        conceptIds: { 'features/cordless': 3 },
        'conceptFacets.features': { 'features/cordless|Cordless': 3, 'features/outdoor|Outdoor|rated': 1, 'features/loose': 2 },
        'conceptFacets.power-source': { 'power-source/battery|Battery': 2 },
        reviewBucket: { '3': 1, '5': 4, '4': 2 },
        availableOnline: { true: 6 },
        availableStores: { s1: 3 },
        minPrice: { '1000': 1 },
        maxPrice: { '9000': 1 },
      },
      { minPrice: stats(1050, 5000), maxPrice: stats(2000, 12345) },
    );

    const parse = (facets?: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
      const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, facets);
      return factory.parseSearchResult(createInitialRequestContext(), body, query(extra));
    };

    it('returns attributes first, then taxonomy, price, rating and availability, and drops the fields behind the typed ones', () => {
      const result = parse();

      expect(result.facets.map((f) => (f.semantic === 'taxonomy' ? `taxonomy:${f.vocabulary}` : f.semantic === 'attribute' ? f.identifier.key : f.semantic))).toEqual([
        'brand',
        'taxonomy:features',
        'taxonomy:power-source',
        'price',
        'rating',
        'availability',
      ]);
    });

    it('marks attribute facets with their multiselect from the policy', () => {
      const asMultiselect = attributeFacets(parse({ multiselect: ['brand'] }).facets);
      const plain = attributeFacets(parse().facets);

      expect(asMultiselect[0]).toMatchObject({ semantic: 'attribute', multiselect: true });
      expect(plain[0]).toMatchObject({ semantic: 'attribute', multiselect: false });
    });

    it('splits taxonomy values on the first bar and falls back to the last part of the id', () => {
      const features = taxonomyFacets(parse().facets).find((f) => f.vocabulary === 'features');

      expect(features).toMatchObject({ semantic: 'taxonomy', name: 'Features', multiselect: true });
      expect(features?.values).toEqual([
        { concept: { key: 'features/cordless' }, name: 'Cordless', count: 3, active: false },
        { concept: { key: 'features/outdoor' }, name: 'Outdoor|rated', count: 1, active: false },
        { concept: { key: 'features/loose' }, name: 'loose', count: 2, active: false },
      ]);
      expect(taxonomyFacets(parse().facets).find((f) => f.vocabulary === 'power-source')?.name).toBe('Power Source');
    });

    it('names the facets from the policy, which wins over the defaults', () => {
      const result = parse({
        names: { price: 'Cost', rating: 'Stars', availability: 'In stock', 'taxonomy:features': 'Properties' },
      });

      expect(priceFacet(result.facets)?.name).toBe('Cost');
      expect(ratingFacet(result.facets)?.name).toBe('Stars');
      expect(availabilityFacet(result.facets)?.name).toBe('In stock');
      expect(taxonomyFacets(result.facets).map((f) => f.name)).toEqual(['Properties', 'Power Source']);
    });

    it('has default names for price, rating and availability', () => {
      const result = parse();

      expect([priceFacet(result.facets)?.name, ratingFacet(result.facets)?.name, availabilityFacet(result.facets)?.name]).toEqual([
        'Price',
        'Rating',
        'Availability',
      ]);
    });

    it('converts the price stats from minor units, the lowest of the minimums and the highest of the maximums', () => {
      expect(priceFacet(parse().facets)).toMatchObject({ semantic: 'price', currency: createInitialRequestContext().languageContext.currencyCode, stats: { min: 10.5, max: 123.45 } });
    });

    it('has no price facet without the stats of both fields', () => {
      const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        { ...body, facets_stats: { minPrice: stats(1, 2) } },
        query({}),
      );

      expect(priceFacet(result.facets)).toBeUndefined();
    });

    it('makes one rating bucket per whole star, the best first', () => {
      expect(ratingFacet(parse().facets)?.buckets).toEqual([
        { min: 5, max: 5, count: 4, active: false },
        { min: 4, max: 4, count: 2, active: false },
        { min: 3, max: 3, count: 1, active: false },
      ]);
    });

    it('marks the rating buckets inside the filter as active', () => {
      expect(ratingFacet(parse(undefined, { ratingFilter: { min: 4 } }).facets)?.buckets.map((b) => b.active)).toEqual([true, true, false]);
    });

    it('maps availability, and only has online when some product is online', () => {
      expect(availabilityFacet(parse().facets)).toMatchObject({
        semantic: 'availability',
        online: { count: 6, active: false },
        stores: [{ store: { key: 's1' }, count: 3, active: false }],
      });

      const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);
      const withoutOnline = factory.parseSearchResult(
        createInitialRequestContext(),
        { ...body, facets: { ...body.facets, availableOnline: { false: 2 } } },
        query({ availabilityFilter: { stores: [{ key: 's1' }] } }),
      );
      const availability = availabilityFacet(withoutOnline.facets);
      expect(availability?.online).toBeUndefined();
      expect(availability?.stores[0].active).toBe(true);
    });

    it('marks the selected concepts and online as active', () => {
      const result = parse(undefined, {
        conceptFilter: [{ key: 'features/outdoor' }],
        availabilityFilter: { online: true },
      });

      expect(taxonomyFacets(result.facets)[0].values.map((v) => v.active)).toEqual([false, true, false]);
      expect(availabilityFacet(result.facets)?.online?.active).toBe(true);
    });

    it('applies the order of the policy as an allowlist, last', () => {
      const result = parse({ order: ['rating', 'taxonomy:power-source', 'price', 'brand'] });

      expect(result.facets.map((f) => f.semantic)).toEqual(['rating', 'taxonomy', 'price', 'attribute']);
      expect(taxonomyFacets(result.facets).map((f) => f.vocabulary)).toEqual(['power-source']);
    });

    it('uses the fields of the configuration', () => {
      const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, {
        fields: { rating: 'stars', online: 'web', stores: 'shops', conceptFacetPrefix: 'tax.', priceMin: 'lo', priceMax: 'hi' },
      });
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        response('main', {
          stars: { '2': 1 },
          web: { true: 1 },
          shops: { x: 1 },
          'tax.features': { 'features/a|A': 1 },
          lo: { '100': 1 },
          hi: { '200': 1 },
        }, { lo: stats(100, 100), hi: stats(200, 200) }),
        query({}),
      );

      expect(result.facets.map((f) => f.semantic).sort()).toEqual(['availability', 'price', 'rating', 'taxonomy']);
      expect(priceFacet(result.facets)?.stats).toEqual({ min: 1, max: 2 });
    });

    it('echoes the typed filters in the identifier and no multiselect', () => {
      const extra = {
        conceptContext: [{ key: 'category/drills' }],
        conceptFilter: [{ key: 'features/cordless' }],
        priceFilter: { min: 1, max: 2 },
        ratingFilter: { min: 3 },
        availabilityFilter: { online: true, stores: [{ key: 's1' }] },
      };
      const result = parse(undefined, extra);

      expect(result.identifier).toMatchObject(extra);
      expect(result.identifier).not.toHaveProperty('multiselect');
    });

    it('does not echo filters the search does not have', () => {
      const identifier = parse().identifier;

      for (const key of ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter']) {
        expect(identifier).not.toHaveProperty(key);
      }
    });
  });

  describe('categories', () => {
    it('still turns the hierarchy facet into the categories facet, never multiselect', () => {
      const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, { multiselect: ['categories'] });
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        response('main', { 'hierarchy.lvl0': { Tools: 3 }, 'hierarchy.lvl1': { 'Tools > Drills': 1 } }),
        query({}),
      );

      const [categories] = attributeFacets(result.facets);
      expect(attributeFacets(result.facets)).toHaveLength(1);
      expect(categories).toMatchObject({ identifier: { key: 'categories' }, name: 'Categories', multiselect: false });
      expect(categories.values.map((v) => v.name)).toEqual(['Tools']);
    });
  });
});
