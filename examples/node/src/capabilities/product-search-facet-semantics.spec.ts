import 'dotenv/config';
import { assert, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  applySearchFacetSelection,
  DEFAULT_SEARCH_FACET_FIELDS,
  getSearchFacetId,
  getSearchFacetOptions,
  hasSearchFacetContent,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type SearchIdentifier,
  type TypedSearchFilter,
} from '@reactionary/core';
import { createClient, PrimaryProvider } from '../utils.js';

/**
 * What the facets of a product search MEAN, checked against every provider that implements them, with real data.
 *
 * The facets are one ordered list, and each says what it is (attribute, taxonomy, price, rating, availability). What a facet
 * offers must be something the search can then apply, and what it shows must be true: the count of an option is the number
 * of products you get when you choose it. A filter the provider cannot apply is refused with an error and never dropped, as the
 * products would not be restricted.
 *
 * The tests find their data in the index instead of naming it, so they run on any catalogue. When the index has nothing to
 * show a semantic with (no ratings, no concepts), the test is skipped with the reason and not passed: a skip is "not checked".
 *
 * Fake needs no backend, and only the shape of its facets and what it refuses is checked: it generates its results and does not restrict them.
 * Run just it with `-t "Fake"`.
 */

vi.setConfig({ testTimeout: 90_000 });

const ALL_FILTERS: TypedSearchFilter[] = ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'];

/** What each provider declares it can apply. A refused filter that is listed here, or an applied one that is not, is a failure of the test, so this stays true. */
const SUPPORTED: Record<string, TypedSearchFilter[]> = {
  [PrimaryProvider.ALGOLIA]: ALL_FILTERS,
  [PrimaryProvider.MEILISEARCH]: ALL_FILTERS,
  [PrimaryProvider.FAKE]: ALL_FILTERS,
  [PrimaryProvider.COMMERCETOOLS]: ['priceFilter', 'ratingFilter', 'availabilityFilter'],
  [PrimaryProvider.MEDUSA]: ['conceptContext'],
  [PrimaryProvider.MAGENTO]: [],
};

/** Whether the provider has facets at all. Undefined where it depends on the shop's configuration. */
const HAS_FACETS: Record<string, boolean | undefined> = {
  [PrimaryProvider.ALGOLIA]: true,
  [PrimaryProvider.MEILISEARCH]: true,
  [PrimaryProvider.FAKE]: true,
  [PrimaryProvider.COMMERCETOOLS]: true,
  [PrimaryProvider.MEDUSA]: false,
  [PrimaryProvider.MAGENTO]: undefined,
};

/** The filter that applies a facet of each semantic. A provider must not offer a facet it would then refuse to apply. */
const FILTER_OF_FACET: Record<ProductSearchResultFacet['semantic'], TypedSearchFilter | undefined> = {
  attribute: undefined,
  taxonomy: 'conceptFilter',
  price: 'priceFilter',
  rating: 'ratingFilter',
  availability: 'availabilityFilter',
};

/** A value for each typed filter, to send to a provider that must refuse it. */
const SAMPLE_FILTER: Record<TypedSearchFilter, Partial<SearchIdentifier>> = {
  conceptContext: { conceptContext: [{ key: 'features/anything' }] },
  conceptFilter: { conceptFilter: [{ key: 'features/anything' }] },
  priceFilter: { priceFilter: { max: 100 } },
  ratingFilter: { ratingFilter: { min: 3, max: 5 } },
  availabilityFilter: { availabilityFilter: { online: true } },
};

type Client = ReturnType<typeof createClient>;
type FacetOf<S extends ProductSearchResultFacet['semantic']> = Extract<ProductSearchResultFacet, { semantic: S }>;

function searchOf(overrides: Partial<SearchIdentifier> = {}): SearchIdentifier {
  return {
    term: '',
    facets: [],
    filters: [],
    paginationOptions: { pageNumber: 1, pageSize: 12 },
    ...overrides,
  };
}

async function runSearch(client: Client, search: SearchIdentifier): Promise<ProductSearchResult> {
  const result = await client.productSearch.queryByTerm({ search });
  if (!result.success) {
    assert.fail(`The search failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function run(client: Client, overrides: Partial<SearchIdentifier> = {}): Promise<ProductSearchResult> {
  return runSearch(client, searchOf(overrides));
}

function facetsOf<S extends ProductSearchResultFacet['semantic']>(result: ProductSearchResult, semantic: S): FacetOf<S>[] {
  return result.facets.filter((facet): facet is FacetOf<S> => facet.semantic === semantic);
}

describe.each([
  PrimaryProvider.FAKE,
  PrimaryProvider.ALGOLIA,
  PrimaryProvider.MEILISEARCH,
  PrimaryProvider.COMMERCETOOLS,
  PrimaryProvider.MEDUSA,
  PrimaryProvider.MAGENTO,
])('Product search facet semantics - %s', (provider) => {
  const supported = SUPPORTED[provider] ?? [];
  const supports = (filter: TypedSearchFilter) => supported.includes(filter);
  // Fake generates its results from a formula and restricts nothing, so only the shape of what it returns is checked
  const restricts = provider !== PrimaryProvider.FAKE;

  let client: Client;
  let base: ProductSearchResult;

  beforeAll(async () => {
    client = createClient(provider);
    base = await run(client);
  });

  describe('the facets', () => {
    it('come as one list, each with a semantic, none empty and none twice', () => {
      const known = ['attribute', 'taxonomy', 'price', 'rating', 'availability'];
      for (const facet of base.facets) {
        expect(known, `semantic of a facet`).toContain(facet.semantic);
        expect(hasSearchFacetContent(facet), `${getSearchFacetId(facet)} has something to show`).toBe(true);
      }
      const ids = base.facets.map(getSearchFacetId);
      expect(new Set(ids).size, `facet ids ${ids.join(', ')}`).toBe(ids.length);

      const expected = HAS_FACETS[provider];
      if (expected !== undefined) {
        expect(base.facets.length > 0, `${provider} has facets: ${base.facets.length}`).toBe(expected);
      }
      console.info(`[${provider}] facets: ${base.facets.map((facet) => `${facet.semantic}:${getSearchFacetId(facet)}`).join(', ') || '(none)'}`);
    });

    it('offer only what the search can apply', () => {
      for (const facet of base.facets) {
        const filter = FILTER_OF_FACET[facet.semantic];
        if (filter) {
          expect(supported, `${provider} offers a ${facet.semantic} facet, so it must apply ${filter}`).toContain(filter);
        }
      }
    });

    it('leave out the index fields that the typed facets are made of', () => {
      const plumbing = [
        DEFAULT_SEARCH_FACET_FIELDS.priceMin,
        DEFAULT_SEARCH_FACET_FIELDS.priceMax,
        DEFAULT_SEARCH_FACET_FIELDS.rating,
        DEFAULT_SEARCH_FACET_FIELDS.online,
        DEFAULT_SEARCH_FACET_FIELDS.stores,
        DEFAULT_SEARCH_FACET_FIELDS.conceptIds,
      ];
      for (const facet of facetsOf(base, 'attribute')) {
        const key = facet.identifier.key;
        expect(plumbing, `"${key}" is an index field of a typed facet`).not.toContain(key);
        expect(key.startsWith(DEFAULT_SEARCH_FACET_FIELDS.conceptFacetPrefix), `"${key}" is a concept facet field`).toBe(false);
      }
    });
  });

  describe('a filter the provider cannot apply', () => {
    const refused = ALL_FILTERS.filter((filter) => !(SUPPORTED[provider] ?? []).includes(filter));

    it.runIf(refused.length > 0)(`is refused with an InvalidInput error (${refused.join(', ') || 'none'}), not dropped`, async () => {
      for (const filter of refused) {
        const result = await client.productSearch.queryByTerm({ search: searchOf(SAMPLE_FILTER[filter]) });
        expect(result.success, `${filter} should be refused, as the products would not be restricted`).toBe(false);
        if (!result.success) {
          expect(result.error.type, `error of ${filter}`).toBe('InvalidInput');
        }
      }
    });

    it('is not refused when the provider supports it (the support table is current)', async ({ skip }) => {
      if (supported.length === 0) {
        skip('This provider supports no typed filter');
        return;
      }
      for (const filter of supported) {
        // Only that the search works: whether it finds anything depends on the data
        const result = await client.productSearch.queryByTerm({ search: searchOf(SAMPLE_FILTER[filter]) });
        expect(result.success, `${filter} is declared as supported: ${JSON.stringify(result.success ? '' : result.error)}`).toBe(true);
      }
    });
  });

  describe.skipIf(!restricts)('price', () => {
    it('is a range that splits the result, and the facet keeps its bounds', async ({ skip }) => {
      const [price] = facetsOf(base, 'price');
      if (!supports('priceFilter')) {
        skip('priceFilter is not supported');
        return;
      }
      if (!price) {
        skip('No price facet in this index');
        return;
      }
      expect(price.currency).toMatch(/^[A-Z]{3}$/);
      expect(price.selected, 'nothing is selected before the search has a priceFilter').toBeUndefined();
      if (!price.stats || price.stats.min >= price.stats.max) {
        skip('The price facet has no spread to split (no stats)');
        return;
      }
      expect(price.stats.min).toBeLessThanOrEqual(price.stats.max);

      const { min, max } = price.stats;
      const middle = (min + max) / 2;
      const low = await run(client, { priceFilter: { max: middle } });
      const high = await run(client, { priceFilter: { min: middle } });
      const everything = await run(client, { priceFilter: { min, max } });

      // With a spread in the prices each half leaves products out. If the filter were dropped, both would equal the whole result
      expect(low.totalCount, 'the lower half is narrower than the whole result').toBeLessThan(base.totalCount);
      expect(high.totalCount, 'the upper half is narrower than the whole result').toBeLessThan(base.totalCount);
      // Both ends are inclusive, so the two halves cover everything and may share the products priced exactly in the middle
      expect(low.totalCount + high.totalCount).toBeGreaterThanOrEqual(base.totalCount);
      expect(everything.totalCount, 'the full range of the stats matches every product').toBe(base.totalCount);
      expect(low.identifier.priceFilter, 'the result carries the filter it was made with').toMatchObject({ max: middle });

      const [lowPrice] = facetsOf(low, 'price');
      assert(lowPrice, 'the price facet is still there with a priceFilter');
      expect(lowPrice.selected?.max).toBeCloseTo(middle);
      expect(lowPrice.stats, 'the bounds stay where they were, so that a slider does not move').toEqual(price.stats);
    });
  });

  describe.skipIf(!restricts)('rating', () => {
    it('is whole stars from 0 to 5 and narrows the result', async ({ skip }) => {
      const [rating] = facetsOf(base, 'rating');
      if (!supports('ratingFilter')) {
        skip('ratingFilter is not supported');
        return;
      }
      if (!rating) {
        skip('No rating facet in this index');
        return;
      }
      for (const bucket of rating.buckets) {
        expect(Number.isInteger(bucket.min) && Number.isInteger(bucket.max), `bucket ${bucket.min}-${bucket.max} is whole stars`).toBe(true);
        expect(bucket.min).toBeGreaterThanOrEqual(0);
        expect(bucket.max).toBeLessThanOrEqual(5);
        expect(bucket.min).toBeLessThanOrEqual(bucket.max);
        expect(bucket.active, 'nothing is selected before the search has a ratingFilter').toBe(false);
      }
      const good = await run(client, { ratingFilter: { min: 4, max: 5 } });
      const bad = await run(client, { ratingFilter: { min: 0, max: 3 } });
      expect(good.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(bad.totalCount).toBeLessThanOrEqual(base.totalCount);
      // The two ranges do not overlap, so they never find more than there is
      expect(good.totalCount + bad.totalCount).toBeLessThanOrEqual(base.totalCount);
    });
  });

  describe.skipIf(!restricts)('availability', () => {
    it('widens: online and the stores are alternatives, and online is a count that is true', async ({ skip }) => {
      const [availability] = facetsOf(base, 'availability');
      if (!supports('availabilityFilter')) {
        skip('availabilityFilter is not supported');
        return;
      }
      if (!availability) {
        skip('No availability facet in this index');
        return;
      }

      if (availability.online && availability.online.count > 0) {
        const online = await run(client, { availabilityFilter: { online: true } });
        expect(online.totalCount, 'the count of online is the number of products you get').toBe(availability.online.count);
        expect(online.totalCount).toBeLessThanOrEqual(base.totalCount);
        expect(facetsOf(online, 'availability')[0]?.online?.active, 'online is active once chosen').toBe(true);
      }

      const [store] = availability.stores.filter((candidate) => candidate.count > 0);
      if (store) {
        const inStore = await run(client, { availabilityFilter: { stores: [store.store] } });
        expect(inStore.totalCount, `the count of store ${store.store.key}`).toBe(store.count);

        if (availability.online) {
          const online = await run(client, { availabilityFilter: { online: true } });
          const either = await run(client, { availabilityFilter: { online: true, stores: [store.store] } });
          expect(either.totalCount, 'online or in the store finds at least what each finds').toBeGreaterThanOrEqual(Math.max(online.totalCount, inStore.totalCount));
          expect(either.totalCount).toBeLessThanOrEqual(online.totalCount + inStore.totalCount);
        }
      } else {
        console.info(`[${provider}] availability: no store with products, only online was checked`);
      }
    });
  });

  describe.skipIf(!restricts)('taxonomy', () => {
    it('widens within a vocabulary and narrows across vocabularies', async ({ skip }) => {
      const facets = facetsOf(base, 'taxonomy').filter((facet) => facet.values.length >= 2);
      if (!supports('conceptFilter')) {
        skip('conceptFilter is not supported');
        return;
      }
      if (facets.length === 0) {
        skip('No taxonomy facet with two concepts in this index');
        return;
      }

      const [first] = facets;
      const [a, b] = first.values;
      const onlyA = await run(client, { conceptFilter: [a.concept] });
      const onlyB = await run(client, { conceptFilter: [b.concept] });
      expect(onlyA.totalCount, `the count of ${a.concept.key}`).toBe(a.count);
      expect(onlyB.totalCount, `the count of ${b.concept.key}`).toBe(b.count);

      const either = await run(client, { conceptFilter: [a.concept, b.concept] });
      expect(either.totalCount, 'two concepts of one vocabulary widen each other').toBeGreaterThanOrEqual(Math.max(onlyA.totalCount, onlyB.totalCount));
      expect(either.totalCount).toBeLessThanOrEqual(onlyA.totalCount + onlyB.totalCount);

      const other = facets.find((facet) => facet.vocabulary !== first.vocabulary);
      if (other) {
        const [c] = other.values;
        const onlyC = await run(client, { conceptFilter: [c.concept] });
        const both = await run(client, { conceptFilter: [a.concept, c.concept] });
        expect(both.totalCount, 'concepts of different vocabularies narrow each other').toBeLessThanOrEqual(Math.min(onlyA.totalCount, onlyC.totalCount));
      } else {
        console.info(`[${provider}] taxonomy: one vocabulary only, the AND across vocabularies was not checked`);
      }
    });
  });

  describe.skipIf(!restricts)('concept context', () => {
    it('restricts the page to a concept of one of its products, and the products below it', async ({ skip }) => {
      if (!supports('conceptContext')) {
        skip('conceptContext is not supported');
        return;
      }
      const item = base.items.find((candidate) => (candidate.concepts?.length ?? 0) > 0);
      if (!item?.concepts) {
        skip('No product with concepts in this index');
        return;
      }

      const concept = item.concepts[0].identifier;
      const scoped = await run(client, { conceptContext: [concept], paginationOptions: { pageNumber: 1, pageSize: 50 } });
      expect(scoped.totalCount, `products of ${concept.key}`).toBeGreaterThan(0);
      expect(scoped.totalCount).toBeLessThanOrEqual(base.totalCount);
      if (scoped.totalCount <= 50) {
        expect(scoped.items.map((candidate) => candidate.identifier.key), 'the product the concept came from').toContain(item.identifier.key);
      }

      if (supports('conceptFilter')) {
        const filtered = await run(client, { conceptFilter: [concept] });
        expect(scoped.totalCount, 'the context also matches the products below the concept, the filter may not').toBeGreaterThanOrEqual(filtered.totalCount);
      }
    });
  });

  describe.skipIf(!restricts)('typed filters of a provider that has no facet for them', () => {
    // commercetools applies price, rating and online filters but returns no facet for them, so there are no stats or buckets to read bounds from
    it('a price filter narrows, and a threshold splits the result', async ({ skip }) => {
      if (!supports('priceFilter') || facetsOf(base, 'price').length > 0) {
        skip('The price facet exists, price is checked with it');
        return;
      }
      let split: { threshold: number; low: ProductSearchResult } | undefined;
      for (const threshold of [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 100000]) {
        const low = await run(client, { priceFilter: { max: threshold } });
        if (low.totalCount > 0 && low.totalCount < base.totalCount) {
          split = { threshold, low };
          break;
        }
      }
      if (!split) {
        skip('No price threshold splits the result in the currency of the request');
        return;
      }
      const high = await run(client, { priceFilter: { min: split.threshold } });
      expect(split.low.totalCount).toBeLessThan(base.totalCount);
      expect(high.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(split.low.totalCount + high.totalCount, 'both halves find something').toBeGreaterThan(0);
      expect(split.low.identifier.priceFilter, 'the result carries the filter it was made with').toMatchObject({ max: split.threshold });
    });

    it('a rating filter narrows, and ranges that do not overlap never find more than there is', async ({ skip }) => {
      if (!supports('ratingFilter') || facetsOf(base, 'rating').length > 0) {
        skip('The rating facet exists, rating is checked with it');
        return;
      }
      const good = await run(client, { ratingFilter: { min: 4, max: 5 } });
      const bad = await run(client, { ratingFilter: { min: 0, max: 3 } });
      expect(good.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(bad.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(good.totalCount + bad.totalCount).toBeLessThanOrEqual(base.totalCount);
      if (good.totalCount + bad.totalCount === 0) {
        console.info(`[${provider}] rating: no product has a rating in this index, only that the filter is accepted was checked`);
      }
    });

    it('an availability filter narrows to online, and online false restricts nothing', async ({ skip }) => {
      if (!supports('availabilityFilter') || facetsOf(base, 'availability').length > 0) {
        skip('The availability facet exists, availability is checked with it');
        return;
      }
      const online = await run(client, { availabilityFilter: { online: true } });
      const notRestricted = await run(client, { availabilityFilter: { online: false } });
      expect(online.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(notRestricted.totalCount, 'online false does not restrict on online availability').toBe(base.totalCount);
    });
  });

  describe.skipIf(!restricts)('options', () => {
    it('have counts that are true: choosing one finds that many products, and it is then active', async ({ skip }) => {
      if (base.facets.length === 0) {
        skip('This provider has no facets');
        return;
      }
      let checked = 0;

      for (const facet of base.facets) {
        const options = getSearchFacetOptions(facet).filter((option) => !option.active && option.count > 0);
        const picked = [...new Set([options[0], options[options.length - 1]])].filter((option) => option !== undefined);
        for (const option of picked) {
          const label = `${facet.semantic} ${getSearchFacetId(facet)} / ${option.key}`;
          const result = await runSearch(client, applySearchFacetSelection(base.identifier, option.selection));
          // Soft: every dishonest count is reported in one run
          expect.soft(result.totalCount, `${label}: the option says ${option.count}`).toBe(option.count);

          const same = result.facets.find((candidate) => getSearchFacetId(candidate) === getSearchFacetId(facet));
          const now = same ? getSearchFacetOptions(same).find((candidate) => candidate.key === option.key) : undefined;
          // A facet may go away when nothing is left to choose in it, but if it stays, the choice shows
          if (now) expect.soft(now.active, `${label}: active after being chosen`).toBe(true);
          checked++;
        }
      }
      expect(checked, 'options that could be chosen').toBeGreaterThan(0);
      console.info(`[${provider}] options checked: ${checked}`);
    });
  });

  describe.skipIf(!restricts)('multiselect attributes', () => {
    it('widen each other, and keep offering the other values', async ({ skip }) => {
      const facet = facetsOf(base, 'attribute').find((candidate) => candidate.multiselect && candidate.values.length >= 2);
      if (!facet) {
        skip('No multiselect attribute facet with two values (it is set in the provider configuration)');
        return;
      }

      const [a, b] = facet.values;
      const onlyA = await run(client, { facets: [a.identifier] });
      const onlyB = await run(client, { facets: [b.identifier] });
      expect(onlyA.totalCount, `the count of ${a.identifier.key}`).toBe(a.count);
      expect(onlyB.totalCount, `the count of ${b.identifier.key}`).toBe(b.count);
      const either = await run(client, { facets: [a.identifier, b.identifier] });
      expect(either.totalCount, 'two values of a multiselect facet widen each other').toBeGreaterThanOrEqual(Math.max(onlyA.totalCount, onlyB.totalCount));
      expect(either.totalCount).toBeLessThanOrEqual(onlyA.totalCount + onlyB.totalCount);

      const same = facetsOf(onlyA, 'attribute').find((candidate) => candidate.identifier.key === facet.identifier.key);
      const stillB = same?.values.find((value) => value.identifier.key === b.identifier.key);
      expect(stillB, `${b.identifier.key} is still offered with ${a.identifier.key} chosen`).toBeDefined();
      expect(stillB?.count, 'with the count it had without the choice').toBe(b.count);
    });
  });

  describe.skipIf(!restricts)('numeric attributes', () => {
    it('have stats, and ranges that narrow the result without moving the stats', async ({ skip }) => {
      const facet = facetsOf(base, 'attribute').find((candidate) => candidate.stats && candidate.stats.min < candidate.stats.max);
      if (!facet?.stats) {
        skip('No numeric attribute facet with stats in this index');
        return;
      }

      const { min, max } = facet.stats;
      const middle = (min + max) / 2;
      const low = await run(client, { ranges: [{ facet: facet.identifier, max: middle }] });
      const high = await run(client, { ranges: [{ facet: facet.identifier, min: middle }] });
      expect(Math.min(low.totalCount, high.totalCount), 'a range leaves products out, a dropped range would not').toBeLessThan(base.totalCount);
      expect(low.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(high.totalCount).toBeLessThanOrEqual(base.totalCount);
      expect(low.totalCount + high.totalCount).toBeGreaterThanOrEqual(base.totalCount);

      // Two ranges on one facet must both match, so they bound it from both sides
      const bounded = await run(client, { ranges: [{ facet: facet.identifier, min }, { facet: facet.identifier, max: middle }] });
      expect(bounded.totalCount, 'a lower limit at the minimum restricts nothing').toBe(low.totalCount);

      const same = facetsOf(low, 'attribute').find((candidate) => candidate.identifier.key === facet.identifier.key);
      expect(same?.stats, 'the stats are those of the search without its ranges').toEqual(facet.stats);
    });
  });
});
