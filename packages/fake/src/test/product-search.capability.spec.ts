import { describe, expect, it } from 'vitest';
import {
  NoOpCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
  getSearchFacetOptions,
  type ProductSearchQueryByTerm,
  type ProductSearchResultFacet,
} from '@reactionary/core';
import { FakeProductSearchCapability } from '../capabilities/product-search.capability.js';
import { FakeProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { getFakerTestConfiguration } from './test-utils.js';

function createCapability() {
  return new FakeProductSearchCapability(
    getFakerTestConfiguration(),
    new NoOpCache(),
    createInitialRequestContext(),
    new FakeProductSearchFactory(ProductSearchResultSchema),
  );
}

function query(search: Partial<ProductSearchQueryByTerm['search']> = {}): ProductSearchQueryByTerm {
  return {
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  };
}

function facetOf<S extends ProductSearchResultFacet['semantic']>(facets: ProductSearchResultFacet[], semantic: S) {
  const facet = facets.find((x) => x.semantic === semantic);
  if (!facet || facet.semantic !== semantic) {
    throw new Error(`no ${semantic} facet`);
  }
  return facet as Extract<ProductSearchResultFacet, { semantic: S }>;
}

describe('FakeProductSearchCapability', () => {
  const capability = createCapability();

  it('returns facets of every semantic', async () => {
    const result = await capability.queryByTerm(query());
    if (!result.success) throw new Error('expected success');
    const kinds = new Set(result.value.facets.map((x) => x.semantic));
    expect([...kinds].sort()).toEqual(['attribute', 'availability', 'price', 'rating', 'taxonomy']);
    const price = facetOf(result.value.facets, 'price');
    expect(price.stats).toBeDefined();
    expect(price.currency).toBe(createInitialRequestContext().languageContext.currencyCode);
    expect(facetOf(result.value.facets, 'availability').stores.length).toBeGreaterThan(0);
  });

  it('is deterministic', async () => {
    const a = await capability.queryByTerm(query());
    const b = await capability.queryByTerm(query());
    expect(a).toEqual(b);
  });

  it('derives active flags from the typed filters', async () => {
    const result = await capability.queryByTerm(
      query({
        facets: [{ facet: { key: 'color' }, key: '2' }],
        conceptFilter: [{ key: 'features/cordless' }],
        priceFilter: { min: 10, max: 100 },
        ratingFilter: { min: 3, max: 4 },
        availabilityFilter: { online: true, stores: [{ key: 'store_1' }] },
      }),
    );
    if (!result.success) throw new Error('expected success');
    const facets = result.value.facets;

    const color = facets.find((x) => x.semantic === 'attribute' && x.identifier.key === 'color');
    expect(color?.semantic === 'attribute' && color.values.filter((v) => v.active).map((v) => v.identifier.key)).toEqual(['2']);
    expect(facetOf(facets, 'taxonomy').values.filter((v) => v.active).map((v) => v.concept.key)).toEqual(['features/cordless']);
    expect(facetOf(facets, 'price').selected).toEqual({ min: 10, max: 100 });
    expect(facetOf(facets, 'rating').buckets.filter((b) => b.active).map((b) => b.min)).toEqual([3, 4]);
    const availability = facetOf(facets, 'availability');
    expect(availability.online?.active).toBe(true);
    expect(availability.stores[0].active).toBe(true);
    expect(facets.flatMap(getSearchFacetOptions).length).toBeGreaterThan(0);
  });

  it('has nothing active without filters', async () => {
    const result = await capability.queryByTerm(query());
    if (!result.success) throw new Error('expected success');
    expect(facetOf(result.value.facets, 'price').selected).toBeUndefined();
    expect(facetOf(result.value.facets, 'rating').buckets.some((b) => b.active)).toBe(false);
    expect(facetOf(result.value.facets, 'availability').online?.active).toBe(false);
  });

  it('echoes the typed filters in the result identifier', async () => {
    const result = await capability.queryByTerm(query({ priceFilter: { max: 50 } }));
    if (!result.success) throw new Error('expected success');
    expect(result.value.identifier.priceFilter).toEqual({ max: 50 });
  });

  it('refuses a facet that names the key of a typed field', async () => {
    const result = await capability.queryByTerm(query({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });
});
