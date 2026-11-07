import { describe, expect, it } from 'vitest';
import type { SearchIdentifier } from '../schemas/models/identifiers.model.js';
import { ProductSearchResultFacetSchema, type ProductSearchResultFacet } from '../schemas/models/product-search.model.js';
import {
  applySearchFacetSelection,
  fromMinorUnits,
  getConceptVocabulary,
  attributeFacetId,
  getSearchFacetId,
  getSearchFacetOptions,
  taxonomyFacetId,
  getSearchFilterProblem,
  groupConceptsByVocabulary,
  orderSearchFacets,
  toMinorUnits,
} from '../utils/search-facets.js';
import { groupFacetSelections, replaceFacets, withFacetStats } from '../utils/search-multiselect.js';
import { createSearchFacetPolicy } from '../utils/search-taxonomy.js';

const search = (overrides: Partial<SearchIdentifier> = {}): SearchIdentifier => ({
  term: '',
  facets: [],
  filters: [],
  paginationOptions: { pageNumber: 1, pageSize: 10 },
  ...overrides,
});

const attribute: ProductSearchResultFacet = {
  semantic: 'attribute',
  identifier: { key: 'manufacturer' },
  name: 'Manufacturer',
  multiselect: false,
  values: [{ identifier: { facet: { key: 'manufacturer' }, key: 'bosch' }, name: 'Bosch', count: 3, active: false }],
};
const taxonomy: ProductSearchResultFacet = {
  semantic: 'taxonomy',
  vocabulary: 'features',
  name: 'Features',
  multiselect: true,
  values: [{ concept: { key: 'features/cordless' }, name: 'Cordless', count: 2, active: true }],
};
const price: ProductSearchResultFacet = { semantic: 'price', name: 'Price', multiselect: false, currency: 'EUR', stats: { min: 5, max: 500 } };
const rating: ProductSearchResultFacet = {
  semantic: 'rating',
  name: 'Rating',
  multiselect: false,
  buckets: [
    { min: 5, max: 5, count: 1, active: false },
    { min: 4, max: 4, count: 4, active: false },
  ],
};
const availability: ProductSearchResultFacet = {
  semantic: 'availability',
  name: 'Availability',
  multiselect: true,
  online: { count: 9, active: false },
  stores: [{ store: { key: 'store-helsinki' }, name: 'Helsinki', count: 2, active: false }],
};

describe('ProductSearchResultFacetSchema', () => {
  it('parses every kind by its semantic and keeps what the provider adds', () => {
    for (const facet of [attribute, taxonomy, price, rating, availability]) {
      expect(ProductSearchResultFacetSchema.parse({ ...facet, extra: 1 })).toEqual({ ...facet, extra: 1 });
    }
  });

  it('refuses a facet without a known semantic', () => {
    expect(ProductSearchResultFacetSchema.safeParse({ identifier: { key: 'x' }, name: 'X', values: [] }).success).toBe(false);
    expect(ProductSearchResultFacetSchema.safeParse({ semantic: 'concept', name: 'X' }).success).toBe(false);
  });

  it('defaults multiselect: taxonomy and availability widen, the rest do not', () => {
    expect(ProductSearchResultFacetSchema.parse({ semantic: 'taxonomy', vocabulary: 'v', name: 'V', values: [] })).toMatchObject({ multiselect: true });
    expect(ProductSearchResultFacetSchema.parse({ semantic: 'availability', name: 'A', stores: [] })).toMatchObject({ multiselect: true });
    expect(ProductSearchResultFacetSchema.parse({ semantic: 'rating', name: 'R', buckets: [] })).toMatchObject({ multiselect: false });
    expect(ProductSearchResultFacetSchema.parse({ semantic: 'attribute', identifier: { key: 'k' }, name: 'K', values: [] })).toMatchObject({ multiselect: false });
  });
});

describe('getSearchFacetId and orderSearchFacets', () => {
  const all = [availability, price, taxonomy, attribute, rating];

  it('identifies a facet by its key, or by its semantic and vocabulary', () => {
    expect(all.map(getSearchFacetId)).toEqual(['availability', 'price', 'taxonomy:features', 'attribute:manufacturer', 'rating']);
  });

  it('puts attributes first, then taxonomy, price, rating and availability, without an order', () => {
    expect(orderSearchFacets(all).map(getSearchFacetId)).toEqual(['attribute:manufacturer', 'taxonomy:features', 'price', 'rating', 'availability']);
  });

  it('returns what the order names, in its order, and nothing else', () => {
    const policy = createSearchFacetPolicy({ order: ['price', 'manufacturer', 'taxonomy:features'] });
    expect(orderSearchFacets(all, policy).map(getSearchFacetId)).toEqual(['price', 'attribute:manufacturer', 'taxonomy:features']);
  });

  it('names every vocabulary with "taxonomy", and an attribute that is called like a kind with "attribute:"', () => {
    const second: ProductSearchResultFacet = { ...taxonomy, vocabulary: 'trade' };
    const priceAttribute: ProductSearchResultFacet = { ...attribute, identifier: { key: 'price' } };
    const policy = createSearchFacetPolicy({ order: ['attribute:price', 'taxonomy', 'price'] });
    expect(orderSearchFacets([price, priceAttribute, taxonomy, second], policy)).toEqual([priceAttribute, taxonomy, second, price]);
  });

  it('skips what the result lacks and lists a facet once', () => {
    const policy = createSearchFacetPolicy({ order: ['rating', 'manufacturer', 'manufacturer', 'attribute:manufacturer'] });
    expect(orderSearchFacets([attribute], policy)).toEqual([attribute]);
  });
});

describe('facet ids', () => {
  it('cannot confuse an attribute with a typed facet or a vocabulary', () => {
    const named = (key: string): ProductSearchResultFacet => ({ ...attribute, identifier: { key } });
    const ids = [named('price'), named('rating'), named('availability'), named('taxonomy:features'), price, rating, availability, taxonomy].map(getSearchFacetId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(attributeFacetId('price')).toBe('attribute:price');
    expect(taxonomyFacetId('features')).toBe('taxonomy:features');
  });

  it('merges by id, so an attribute called price keeps its own stats and values', () => {
    const priceAttribute: ProductSearchResultFacet = { ...attribute, identifier: { key: 'price' }, stats: { min: 1, max: 2 } };
    const merged = withFacetStats([priceAttribute, price], [{ ...price, stats: { min: 7, max: 9 } }]);
    expect(merged[0]).toMatchObject({ semantic: 'attribute', stats: { min: 1, max: 2 } });
    expect(merged[1]).toMatchObject({ semantic: 'price', stats: { min: 7, max: 9 } });
  });
});

describe('getSearchFacetOptions', () => {
  it('lists the values of attribute and taxonomy facets', () => {
    expect(getSearchFacetOptions(attribute)).toEqual([
      { key: 'bosch', label: 'Bosch', count: 3, active: false, selection: { semantic: 'attribute', value: { facet: { key: 'manufacturer' }, key: 'bosch' } } },
    ]);
    expect(getSearchFacetOptions(taxonomy)).toEqual([
      { key: 'features/cordless', label: 'Cordless', count: 2, active: true, selection: { semantic: 'taxonomy', concept: { key: 'features/cordless' } } },
    ]);
  });

  it('lists the buckets of a rating by their stars', () => {
    expect(getSearchFacetOptions(rating).map((x) => [x.key, x.label, x.selection])).toEqual([
      ['5-5', '5', { semantic: 'rating', min: 5, max: 5 }],
      ['4-4', '4', { semantic: 'rating', min: 4, max: 4 }],
    ]);
  });

  it('lists online first and then the stores, by name when it is known', () => {
    expect(getSearchFacetOptions(availability).map((x) => [x.key, x.label, x.count])).toEqual([
      ['online', 'online', 9],
      ['store:store-helsinki', 'Helsinki', 2],
    ]);
    const nameless: ProductSearchResultFacet = { ...availability, online: undefined, stores: [{ store: { key: 's1' }, count: 1, active: false }] };
    expect(getSearchFacetOptions(nameless).map((x) => x.label)).toEqual(['s1']);
  });

  it('has no options for a price, which is a range', () => {
    expect(getSearchFacetOptions(price)).toEqual([]);
  });
});

describe('applySearchFacetSelection', () => {
  it('toggles attribute values in facets, and does not change the search it is given', () => {
    const value = { facet: { key: 'manufacturer' }, key: 'bosch' };
    const original = search();
    const selected = applySearchFacetSelection(original, { semantic: 'attribute', value });
    expect(selected.facets).toEqual([value]);
    expect(original.facets).toEqual([]);
    expect(applySearchFacetSelection(selected, { semantic: 'attribute', value }).facets).toEqual([]);
  });

  it('toggles concepts in conceptFilter and leaves the other fields alone', () => {
    const concept = { key: 'features/cordless' };
    const selected = applySearchFacetSelection(search({ conceptContext: [{ key: 'application/garden' }] }), { semantic: 'taxonomy', concept });
    expect(selected.conceptFilter).toEqual([concept]);
    expect(selected.conceptContext).toEqual([{ key: 'application/garden' }]);
    expect(applySearchFacetSelection(selected, { semantic: 'taxonomy', concept }).conceptFilter).toEqual([]);
  });

  describe('rating', () => {
    const pick = (s: SearchIdentifier, stars: number) => applySearchFacetSelection(s, { semantic: 'rating', min: stars, max: stars }).ratingFilter;

    it('starts a range from the first bucket', () => {
      expect(pick(search(), 2)).toEqual({ min: 2, max: 2 });
    });

    it('extends the range by the bucket next to it, on either side', () => {
      expect(pick(search({ ratingFilter: { min: 2, max: 2 } }), 3)).toEqual({ min: 2, max: 3 });
      expect(pick(search({ ratingFilter: { min: 2, max: 3 } }), 1)).toEqual({ min: 1, max: 3 });
    });

    it('starts again from a bucket that is not next to the range', () => {
      expect(pick(search({ ratingFilter: { min: 1, max: 2 } }), 5)).toEqual({ min: 5, max: 5 });
    });

    it('takes a bucket off the end of the range, and the filter off with the last one', () => {
      expect(pick(search({ ratingFilter: { min: 2, max: 4 } }), 2)).toEqual({ min: 3, max: 4 });
      expect(pick(search({ ratingFilter: { min: 2, max: 4 } }), 4)).toEqual({ min: 2, max: 3 });
      expect(applySearchFacetSelection(search({ ratingFilter: { min: 3, max: 3 } }), { semantic: 'rating', min: 3, max: 3 })).not.toHaveProperty('ratingFilter');
    });

    it('starts again from a bucket in the middle of the range', () => {
      expect(pick(search({ ratingFilter: { min: 1, max: 5 } }), 3)).toEqual({ min: 3, max: 3 });
    });

    it('treats a range without ends as no range', () => {
      expect(pick(search({ ratingFilter: {} }), 4)).toEqual({ min: 4, max: 4 });
    });
  });

  describe('availability', () => {
    const store = (key: string) => ({ semantic: 'availability', store: { key } }) as const;

    it('toggles online, and drops the filter when nothing is left', () => {
      const online = applySearchFacetSelection(search(), { semantic: 'availability', online: true });
      expect(online.availabilityFilter).toEqual({ online: true });
      expect(applySearchFacetSelection(online, { semantic: 'availability', online: true })).not.toHaveProperty('availabilityFilter');
    });

    it('toggles stores next to online', () => {
      let current = applySearchFacetSelection(search(), { semantic: 'availability', online: true });
      current = applySearchFacetSelection(current, store('a'));
      current = applySearchFacetSelection(current, store('b'));
      expect(current.availabilityFilter).toEqual({ online: true, stores: [{ key: 'a' }, { key: 'b' }] });
      current = applySearchFacetSelection(current, store('a'));
      expect(current.availabilityFilter).toEqual({ online: true, stores: [{ key: 'b' }] });
    });
  });

  it('sets and clears the price range, which replaces what was selected', () => {
    const set = applySearchFacetSelection(search({ priceFilter: { min: 1, max: 2 } }), { semantic: 'price', range: { min: 10, max: 50 } });
    expect(set.priceFilter).toEqual({ min: 10, max: 50 });
    expect(applySearchFacetSelection(set, { semantic: 'price' })).not.toHaveProperty('priceFilter');
    expect(applySearchFacetSelection(set, { semantic: 'price', range: {} })).not.toHaveProperty('priceFilter');
  });
});

describe('getSearchFilterProblem', () => {
  const everything = ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'] as const;

  it('has no problem with a search that is plain, or that an empty filter is on', () => {
    expect(getSearchFilterProblem(search(), [])).toBeUndefined();
    expect(getSearchFilterProblem(search({ conceptFilter: [], priceFilter: {}, ratingFilter: {}, availabilityFilter: { stores: [] } }), [])).toBeUndefined();
    expect(getSearchFilterProblem(search({ availabilityFilter: { online: false } }), [])).toBeUndefined();
  });

  it('refuses a filter the provider does not support, and names it', () => {
    expect(getSearchFilterProblem(search({ ratingFilter: { min: 4 }, priceFilter: { max: 10 } }), ['priceFilter'])).toMatch(/ratingFilter/);
    expect(getSearchFilterProblem(search({ ratingFilter: { min: 4 }, priceFilter: { max: 10 } }), ['priceFilter'])).not.toMatch(/priceFilter/);
    expect(getSearchFilterProblem(search({ conceptContext: [{ key: 'a/b' }] }), [])).toMatch(/conceptContext/);
  });

  it('accepts every filter of a provider that supports them', () => {
    const full = search({ conceptContext: [{ key: 'a/b' }], conceptFilter: [{ key: 'a/c' }], priceFilter: { min: 1 }, ratingFilter: { max: 2 }, availabilityFilter: { online: true } });
    expect(getSearchFilterProblem(full, everything)).toBeUndefined();
  });

  it('refuses facets and ranges on the fields behind the typed facets', () => {
    expect(getSearchFilterProblem(search({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }), everything)).toMatch(/reviewBucket/);
    expect(getSearchFilterProblem(search({ facets: [{ facet: { key: 'conceptFacets.features' }, key: 'x' }] }), everything)).toMatch(/conceptFacets\.features/);
    expect(getSearchFilterProblem(search({ ranges: [{ facet: { key: 'minPrice' }, min: 100 }] }), everything)).toMatch(/minPrice/);
    expect(getSearchFilterProblem(search({ facets: [{ facet: { key: 'manufacturer' }, key: 'bosch' }], ranges: [{ facet: { key: 'wattage' }, max: 900 }] }), everything)).toBeUndefined();
  });

  it('refuses the multiselect of the search that was removed, so that stale clients see the change', () => {
    const stale = { ...search(), multiselect: [{ key: 'color' }] };
    expect(getSearchFilterProblem(stale, everything)).toMatch(/facet policy/);
    const empty = { ...search(), multiselect: [] };
    expect(getSearchFilterProblem(empty, everything)).toBeUndefined();
  });

  it('refuses a concept without a vocabulary, which no facet can match', () => {
    expect(getSearchFilterProblem(search({ conceptFilter: [{ key: 'cordless' }] }), everything)).toMatch(/"cordless" has no vocabulary/);
    expect(getSearchFilterProblem(search({ conceptContext: [{ key: 'features/cordless' }, { key: 'orphan' }] }), everything)).toMatch(/"orphan"/);
    expect(getSearchFilterProblem(search({ conceptFilter: [{ key: 'features/cordless' }] }), everything)).toBeUndefined();
  });

  it('uses the fields of the policy', () => {
    const policy = createSearchFacetPolicy({ fields: { rating: 'avgRating' } });
    expect(getSearchFilterProblem(search({ facets: [{ facet: { key: 'avgRating' }, key: '4' }] }), everything, policy)).toMatch(/avgRating/);
    expect(getSearchFilterProblem(search({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }), everything, policy)).toBeUndefined();
  });
});

describe('concepts and money', () => {
  it('reads the vocabulary from the prefix of the key', () => {
    expect(getConceptVocabulary({ key: 'features/cordless' })).toBe('features');
    expect(getConceptVocabulary({ key: 'a/b/c' })).toBe('a');
    expect(getConceptVocabulary({ key: 'cordless' })).toBe('');
  });

  it('groups concepts by vocabulary, keeping the order', () => {
    const groups = groupConceptsByVocabulary([{ key: 'a/1' }, { key: 'b/1' }, { key: 'a/2' }]);
    expect([...groups.entries()]).toEqual([['a', [{ key: 'a/1' }, { key: 'a/2' }]], ['b', [{ key: 'b/1' }]]]);
    expect(groupConceptsByVocabulary(undefined).size).toBe(0);
  });

  it('converts between decimal amounts and minor units by the digits of the currency', () => {
    expect(toMinorUnits(12.5, 'EUR')).toBe(1250);
    expect(toMinorUnits(19.99, 'DKK')).toBe(1999);
    expect(toMinorUnits(1234, 'JPY')).toBe(1234);
    expect(toMinorUnits(1.234, 'KWD')).toBe(1234);
    expect(fromMinorUnits(1250, 'EUR')).toBe(12.5);
    expect(fromMinorUnits(1234, 'JPY')).toBe(1234);
  });

  it('rounds away the float noise of an amount', () => {
    expect(toMinorUnits(0.1 + 0.2, 'EUR')).toBe(30);
    expect(toMinorUnits(1.005, 'EUR')).toBe(101);
  });
});

describe('facet merging with the kinds of facets', () => {
  it('groups attribute selections by the multiselect keys of the policy', () => {
    const a = { facet: { key: 'color' }, key: 'red' };
    const b = { facet: { key: 'color' }, key: 'blue' };
    const c = { facet: { key: 'size' }, key: 'l' };
    const groups = groupFacetSelections([a, b, c], ['color', 'categories']);
    expect(groups.single).toEqual([c]);
    expect(groups.multi.get('color')).toEqual([a, b]);
    expect(groupFacetSelections([a, b], undefined).single).toEqual([a, b]);
    expect(groupFacetSelections([{ facet: { key: 'categories' }, key: 'x' }], ['categories']).single).toHaveLength(1);
  });

  it('replaces a facet of any kind in place, appends what is missing and ignores an empty replacement', () => {
    const newerTaxonomy: ProductSearchResultFacet = { ...taxonomy, values: [{ concept: { key: 'features/corded' }, name: 'Corded', count: 7, active: false }] };
    const emptyRating: ProductSearchResultFacet = { ...rating, buckets: [] };
    const merged = replaceFacets([attribute, taxonomy, rating], [newerTaxonomy, emptyRating, availability]);
    expect(merged).toEqual([attribute, newerTaxonomy, rating, availability]);
  });

  it('takes the stats of attribute and price facets, and nothing else', () => {
    const wider: ProductSearchResultFacet = { ...price, stats: { min: 1, max: 1000 } };
    expect(withFacetStats([price], [wider])).toEqual([wider]);

    const numeric: ProductSearchResultFacet = { ...attribute, identifier: { key: 'wattage' }, stats: { min: 1, max: 9 } };
    expect(withFacetStats([{ ...numeric, stats: { min: 3, max: 4 }, values: [numeric.values[0]] }], [numeric])[0]).toMatchObject({ stats: { min: 1, max: 9 }, values: [numeric.values[0]] });
    // a facet the result lacks comes without values, so that a slider keeps its bounds
    expect(withFacetStats([], [numeric])).toEqual([{ ...numeric, values: [] }]);
    expect(withFacetStats([], [wider])).toEqual([wider]);
    // taxonomy has no stats
    expect(withFacetStats([taxonomy], [taxonomy])).toEqual([taxonomy]);
  });
});
