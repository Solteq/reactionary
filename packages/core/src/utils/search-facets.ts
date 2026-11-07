import type { ConceptIdentifier, FacetValueIdentifier, SearchAvailabilityFilter, SearchIdentifier as ProductSearchIdentifier, SearchRange, StoreIdentifier } from '../schemas/models/identifiers.model.js';
import type { ProductSearchResultFacet } from '../schemas/models/product-search.model.js';
import { DEFAULT_SEARCH_FACET_POLICY, type SearchFacetFields, type SearchFacetPolicy } from './search-taxonomy.js';

/** The facets of the product search that are about a part of the domain model, and have a field of their own in the search. */
export type SearchFacetSemantic = ProductSearchResultFacet['semantic'];

/** The filters of a product search that are typed, and so can be refused by a provider that cannot apply them. */
export type TypedSearchFilter = 'conceptContext' | 'conceptFilter' | 'priceFilter' | 'ratingFilter' | 'availabilityFilter';

const ALL_TYPED_SEARCH_FILTERS: TypedSearchFilter[] = ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'];

/** The words of the facet order that are kinds of facets rather than attributes. */
const KIND_WORDS: SearchFacetSemantic[] = ['price', 'rating', 'availability', 'taxonomy'];

/** The highest rating a product can have, in whole stars. */
export const MAX_SEARCH_RATING = 5;

// ---------------------------------------------------------------------------------------------------------------------
// facet identity and order
// ---------------------------------------------------------------------------------------------------------------------

/** The id of the attribute facet with this key, see `getSearchFacetId`. */
export function attributeFacetId(key: string): string {
  return `attribute:${key}`;
}

/** The id of the taxonomy facet of this vocabulary, see `getSearchFacetId`. */
export function taxonomyFacetId(vocabulary: string): string {
  return `taxonomy:${vocabulary}`;
}

/**
 * The key a facet is known by within a search result, the same for the facet of a search with and without a selection:
 * "attribute:<key>", "taxonomy:<vocabulary>", or the semantic for price, rating and availability. An attribute is always
 * prefixed, so that an attribute called "price" is not mistaken for the price facet. Providers name the facets they take from an
 * extra request with `attributeFacetId` and `taxonomyFacetId`, not by writing the ids themselves.
 */
export function getSearchFacetId(facet: ProductSearchResultFacet): string {
  switch (facet.semantic) {
    case 'attribute':
      return attributeFacetId(facet.identifier.key);
    case 'taxonomy':
      return taxonomyFacetId(facet.vocabulary);
    default:
      return facet.semantic;
  }
}

/** Whether a facet has anything to offer: values, buckets, stores or bounds. */
export function hasSearchFacetContent(facet: ProductSearchResultFacet): boolean {
  switch (facet.semantic) {
    case 'attribute':
    case 'taxonomy':
      return facet.values.length > 0;
    case 'rating':
      return facet.buckets.length > 0;
    case 'availability':
      return facet.online !== undefined || facet.stores.length > 0;
    case 'price':
      return facet.stats !== undefined;
  }
}

function matchesOrderEntry(facet: ProductSearchResultFacet, entry: string): boolean {
  if (entry.startsWith('attribute:')) {
    return facet.semantic === 'attribute' && facet.identifier.key === entry.slice('attribute:'.length);
  }
  if (KIND_WORDS.includes(entry as SearchFacetSemantic)) {
    return facet.semantic === entry;
  }
  if (entry.startsWith('taxonomy:')) {
    return facet.semantic === 'taxonomy' && facet.vocabulary === entry.slice('taxonomy:'.length);
  }
  return facet.semantic === 'attribute' && facet.identifier.key === entry;
}

/**
 * Puts the facets of a search result in the order of the policy, and leaves out those it does not name. Without an order every facet stays,
 * attributes first in the order of the engine, then taxonomy, price, rating and availability. A facet is listed once, by the first entry that names it.
 */
export function orderSearchFacets(facets: ProductSearchResultFacet[], policy: SearchFacetPolicy = DEFAULT_SEARCH_FACET_POLICY): ProductSearchResultFacet[] {
  if (!policy.order) {
    const rank: Record<SearchFacetSemantic, number> = { attribute: 0, taxonomy: 1, price: 2, rating: 3, availability: 4 };
    return facets
      .map((facet, index) => ({ facet, index }))
      .sort((a, b) => rank[a.facet.semantic] - rank[b.facet.semantic] || a.index - b.index)
      .map((x) => x.facet);
  }
  const ordered: ProductSearchResultFacet[] = [];
  for (const entry of policy.order) {
    for (const facet of facets) {
      if (matchesOrderEntry(facet, entry) && !ordered.includes(facet)) {
        ordered.push(facet);
      }
    }
  }
  return ordered;
}

// ---------------------------------------------------------------------------------------------------------------------
// concepts
// ---------------------------------------------------------------------------------------------------------------------

/** The vocabulary of a concept, the prefix of its key: "features" for "features/cordless". A key without prefix has none, "". */
export function getConceptVocabulary(concept: ConceptIdentifier): string {
  const separator = concept.key.indexOf('/');
  return separator > 0 ? concept.key.slice(0, separator) : '';
}

/** The concepts by vocabulary, each in the order given. */
export function groupConceptsByVocabulary(concepts: ConceptIdentifier[] | undefined): Map<string, ConceptIdentifier[]> {
  const groups = new Map<string, ConceptIdentifier[]>();
  for (const concept of concepts ?? []) {
    const vocabulary = getConceptVocabulary(concept);
    groups.set(vocabulary, [...(groups.get(vocabulary) ?? []), concept]);
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------------------------------
// money
// ---------------------------------------------------------------------------------------------------------------------

const minorUnitDigits = new Map<string, number>();

function getMinorUnitDigits(currency: string): number {
  const known = minorUnitDigits.get(currency);
  if (known !== undefined) {
    return known;
  }
  let digits = 2;
  try {
    // building a NumberFormat is slow and the digits of a currency do not change, so they are kept
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // an unknown currency code is two digits, like most
  }
  minorUnitDigits.set(currency, digits);
  return digits;
}

/** A decimal amount like MonetaryAmount.value in the minor units of its currency, e.g. 12.5 EUR is 1250. Indexes keep prices this way. */
export function toMinorUnits(amount: number, currency: string): number {
  // 1.005 * 100 is 100.49999999999999, so the product is cut to the 15 digits a double holds before it is rounded
  return Math.round(Number((amount * 10 ** getMinorUnitDigits(currency)).toPrecision(15)));
}

/** The decimal amount of minor units, the other way round of toMinorUnits. */
export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** getMinorUnitDigits(currency);
}

// ---------------------------------------------------------------------------------------------------------------------
// refusing what a provider cannot do
// ---------------------------------------------------------------------------------------------------------------------

function isRestricting(range: SearchRange | undefined): boolean {
  return range !== undefined && (range.min !== undefined || range.max !== undefined);
}

/** The typed filters a search actually restricts on. An empty one, like `{}` or `[]`, does not. */
export function getActiveTypedSearchFilters(search: Pick<ProductSearchIdentifier, TypedSearchFilter>): TypedSearchFilter[] {
  return ALL_TYPED_SEARCH_FILTERS.filter((filter) => {
    switch (filter) {
      case 'conceptContext':
      case 'conceptFilter':
        return (search[filter]?.length ?? 0) > 0;
      case 'priceFilter':
      case 'ratingFilter':
        return isRestricting(search[filter]);
      case 'availabilityFilter':
        return search.availabilityFilter?.online === true || (search.availabilityFilter?.stores?.length ?? 0) > 0;
    }
  });
}

/** The index fields of the typed facets, which a search must not select as attribute facets or ranges. */
function getReservedFacetKeys(fields: SearchFacetFields): string[] {
  return [fields.priceMin, fields.priceMax, fields.rating, fields.online, fields.stores, fields.conceptIds, fields.conceptFacetPrefix.replace(/\.$/, '')];
}

/**
 * Checks a search against what the provider can do, so that a hard filter is never dropped silently: a storefront that asks for "in stock"
 * must not get products that are not. Returns the message of an InvalidInput error, or undefined when the search is fine.
 *
 * It refuses the typed filters the provider does not list in `supported`, and facets and ranges that name an index field that has a typed
 * field of its own (reviewBucket is selected with ratingFilter, not with a facet).
 */
export function getSearchFilterProblem(
  search: Pick<ProductSearchIdentifier, TypedSearchFilter | 'facets' | 'ranges'>,
  supported: readonly TypedSearchFilter[],
  policy: SearchFacetPolicy = DEFAULT_SEARCH_FACET_POLICY,
): string | undefined {
  // multiselect used to be a field of the search. It is read from the facet policy now, so a client that still sends it would get
  // narrowing facets without any error: refuse it, so that the change is seen.
  if ('multiselect' in search && Array.isArray(search.multiselect) && search.multiselect.length > 0) {
    return 'The search has no multiselect any more. The facets that are multiselect are set in the facet policy of the provider (facets.multiselect), and the facets that come back say whether they are.';
  }
  const unsupported = getActiveTypedSearchFilters(search).filter((filter) => !supported.includes(filter));
  if (unsupported.length > 0) {
    return `This product search provider cannot apply ${unsupported.join(', ')}. Search without ${unsupported.length === 1 ? 'it' : 'them'}, as the products would not be restricted.`;
  }
  const withoutVocabulary = [...(search.conceptContext ?? []), ...(search.conceptFilter ?? [])].find((concept) => getConceptVocabulary(concept) === '');
  if (withoutVocabulary) {
    return `The concept "${withoutVocabulary.key}" has no vocabulary. A concept key is "<vocabulary>/<concept>", like "features/cordless".`;
  }
  const reserved = getReservedFacetKeys(policy.fields);
  const isReserved = (key: string) => reserved.some((field) => key === field || key.startsWith(`${field}.`));
  const facet = search.facets.find((value) => isReserved(value.facet.key));
  const range = search.ranges?.find((value) => isReserved(value.facet.key));
  const key = facet?.facet.key ?? range?.facet.key;
  if (key !== undefined) {
    return `The facet "${key}" belongs to price, rating, availability or taxonomy, which are selected with priceFilter, ratingFilter, availabilityFilter and conceptFilter, not with facets or ranges.`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// selecting
// ---------------------------------------------------------------------------------------------------------------------

/** What choosing an option of a facet does to the search. */
export type SearchFacetSelection =
  | { semantic: 'attribute'; value: FacetValueIdentifier }
  | { semantic: 'taxonomy'; concept: ConceptIdentifier }
  | { semantic: 'rating'; min: number; max: number }
  | { semantic: 'availability'; online: true }
  | { semantic: 'availability'; store: StoreIdentifier }
  /** Sets the price range, or clears it when left out. Unlike the others it replaces what was selected. */
  | { semantic: 'price'; range?: SearchRange };

/** One thing to choose in a facet, in the way every widget that lists options can show it. */
export interface SearchFacetOption {
  /** Stable within its facet, for lists. */
  key: string;
  label: string;
  count: number;
  active: boolean;
  selection: SearchFacetSelection;
}

/**
 * The options of a facet as one uniform list, so that a storefront needs one widget for all of them: the values of an attribute or taxonomy
 * facet, the buckets of a rating (the label is the number of stars, "4", or "1-2"), and online and the stores of availability.
 * A price facet has no options, it is a range, see `SearchFacetSelection`.
 */
export function getSearchFacetOptions(facet: ProductSearchResultFacet): SearchFacetOption[] {
  switch (facet.semantic) {
    case 'attribute':
      return facet.values.map((value) => ({
        key: value.identifier.key,
        label: value.name,
        count: value.count,
        active: value.active,
        selection: { semantic: 'attribute', value: value.identifier },
      }));
    case 'taxonomy':
      return facet.values.map((value) => ({
        key: value.concept.key,
        label: value.name,
        count: value.count,
        active: value.active,
        selection: { semantic: 'taxonomy', concept: value.concept },
      }));
    case 'rating':
      return facet.buckets.map((bucket) => ({
        key: `${bucket.min}-${bucket.max}`,
        label: bucket.min === bucket.max ? `${bucket.min}` : `${bucket.min}-${bucket.max}`,
        count: bucket.count,
        active: bucket.active,
        selection: { semantic: 'rating', min: bucket.min, max: bucket.max },
      }));
    case 'availability': {
      const options: SearchFacetOption[] = facet.stores.map((store) => ({
        key: `store:${store.store.key}`,
        label: typeof store.name === 'string' ? store.name : store.store.key,
        count: store.count,
        active: store.active,
        selection: { semantic: 'availability', store: store.store },
      }));
      if (facet.online) {
        options.unshift({
          key: 'online',
          label: 'online',
          count: facet.online.count,
          active: facet.online.active,
          selection: { semantic: 'availability', online: true },
        });
      }
      return options;
    }
    case 'price':
      return [];
  }
}

function toggle<T>(list: T[] | undefined, item: T, same: (a: T, b: T) => boolean): T[] {
  const current = list ?? [];
  return current.some((x) => same(x, item)) ? current.filter((x) => !same(x, item)) : [...current, item];
}

function toggleRatingBucket(current: SearchRange | undefined, min: number, max: number): SearchRange | undefined {
  if (!current || (current.min === undefined && current.max === undefined)) {
    return { min, max };
  }
  const low = current.min ?? 0;
  const high = current.max ?? MAX_SEARCH_RATING;
  const covered = min >= low && max <= high;
  if (covered) {
    // take the bucket off one end, and when it is in the middle there is no way to take it out of a range: start again from the bucket
    if (min === low && max === high) {
      return undefined;
    }
    if (min === low) {
      return { min: max + 1, max: high };
    }
    if (max === high) {
      return { min: low, max: min - 1 };
    }
    return { min, max };
  }
  // extend the range when the bucket is next to it, otherwise start again from the bucket
  if (max === low - 1) {
    return { min, max: high };
  }
  if (min === high + 1) {
    return { min: low, max };
  }
  return { min, max };
}

/**
 * Chooses an option of a facet in a search, or takes it off when it is chosen already, and returns the new search. It writes the
 * choice to the field of the search that belongs to the kind of facet, so that a storefront has one click handler for every facet:
 * attributes go to `facets`, taxonomy to `conceptFilter`, rating to `ratingFilter`, availability to `availabilityFilter` and price to `priceFilter`.
 * What is chosen is found in the search itself, not in the `active` flag of the option, which may be from an older result.
 * The search passed is not changed, and its page is not reset: do that when the selection changes.
 */
export function applySearchFacetSelection(search: ProductSearchIdentifier, selection: SearchFacetSelection): ProductSearchIdentifier {
  switch (selection.semantic) {
    case 'attribute':
      return { ...search, facets: toggle(search.facets, selection.value, (a, b) => a.facet.key === b.facet.key && a.key === b.key) };
    case 'taxonomy': {
      const conceptFilter = toggle(search.conceptFilter, selection.concept, (a, b) => a.key === b.key);
      return { ...search, conceptFilter };
    }
    case 'rating': {
      const ratingFilter = toggleRatingBucket(search.ratingFilter, selection.min, selection.max);
      const { ratingFilter: _previous, ...rest } = search;
      return ratingFilter ? { ...rest, ratingFilter } : rest;
    }
    case 'availability': {
      const current: SearchAvailabilityFilter = search.availabilityFilter ?? {};
      const next: SearchAvailabilityFilter = 'online' in selection
        ? { ...current, online: current.online === true ? undefined : true }
        : { ...current, stores: toggle(current.stores, selection.store, (a, b) => a.key === b.key) };
      const { availabilityFilter: _previous, ...rest } = search;
      const stores = next.stores ?? [];
      if (next.online !== true && stores.length === 0) {
        return rest;
      }
      return { ...rest, availabilityFilter: { ...(next.online === true ? { online: true } : {}), ...(stores.length > 0 ? { stores } : {}) } };
    }
    case 'price': {
      const { priceFilter: _previous, ...rest } = search;
      return isRestricting(selection.range) ? { ...rest, priceFilter: selection.range } : rest;
    }
  }
}
