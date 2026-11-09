import {
  type Cache,
  createSearchFacetPolicy,
  error,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
  getConceptVocabulary,
  attributeFacetId,
  getSearchFacetId,
  taxonomyFacetId,
  getSearchFilterProblem,
  groupConceptsByVocabulary,
  groupFacetSelections,
  type InvalidInputError,
  orderSearchFacets,
  type PersonalizationProfile,
  ProductSearchCapability,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryCreateNavigationFilter,
  type RequestContext,
  type Result,
  ProductSearchResultSchema,
  Reactionary,
  replaceFacets,
  type SearchFacetPolicy,
  success,
  toMinorUnits,
  withFacetStats,
} from '@reactionary/core';
import { algoliasearch, type SearchQuery } from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaNativeRecord } from '../schema/search.schema.js';
import type { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';
import { markSelectedFacets } from '../core/facet-selection.js';
import { AlgoliaPersonalization } from '../core/personalization.js';

/**
 * A request next to the main one, for facets the selection of the main search hides. `search` is the search without that selection.
 * `replace` facets take the place of the facets of the main search, `stats` facets only give their stats to them.
 */
export interface AlgoliaFacetCountSearch {
  mode: 'replace' | 'stats';
  search: ProductSearchQueryByTerm;
  /** The ids of the facets to take from the response, see getSearchFacetId. */
  ids: string[];
  /** The index facets to ask for. */
  fields: string[];
}

export class AlgoliaProductSearchCapability<
  TFactory extends ProductSearchFactory = AlgoliaProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: AlgoliaConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;
  /** Which facets are multiselect and which index fields stand behind the typed filters, from the `facets` of the configuration. */
  protected facetPolicy: SearchFacetPolicy;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: AlgoliaConfiguration,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.facetPolicy = createSearchFacetPolicy(config.facets);
  }

  /**
   * How the segments and interests of a visitor become rule contexts and optional filters. Override it to change that. The search and the
   * recommendations capabilities have no common base class, so override it in both to change both.
   */
  protected personalization(): AlgoliaPersonalization {
    return new AlgoliaPersonalization(this.config);
  }

  /** The rule contexts of a visitor. `reserved` is the room other contexts sent next to these take. */
  protected ruleContextsOf(profile: Pick<PersonalizationProfile, 'segments'> | undefined, reserved = 0): string[] {
    return this.personalization().ruleContexts(profile, reserved);
  }

  /** The optional filters that rank by the interests of a visitor. */
  protected optionalFiltersOf(profile: Pick<PersonalizationProfile, 'affinities'> | undefined): string[] {
    return this.personalization().optionalFilters(profile);
  }

  /**
   * The facet filters of the typed filters and the attribute facets. Algolia ANDs the entries of facetFilters and ORs the values of a nested array.
   * Concepts of the context are one entry each, the concepts of a vocabulary are one nested array (conceptIds hold the ancestors, so a concept
   * matches the products of the concepts below it), and so are the multiselect facets and the availability.
   */
  protected facetFiltersOf(payload: ProductSearchQueryByTerm): (string | string[])[] {
    const { fields } = this.facetPolicy;
    const search = payload.search;
    const facetsThatAreNotCategory = search.facets.filter((x) => x.facet.key !== 'categories');
    const selections = groupFacetSelections(facetsThatAreNotCategory, this.facetPolicy.multiselect);

    const availability: string[] = [
      ...(search.availabilityFilter?.online === true ? [`${fields.online}:true`] : []),
      ...(search.availabilityFilter?.stores ?? []).map((store) => `${fields.stores}:${store.key}`),
    ];

    return [
      ...selections.single.map((x) => `${x.facet.key}:${x.key}`),
      ...Array.from(selections.multi.values(), (values) => values.map((x) => `${x.facet.key}:${x.key}`)),
      ...(search.conceptContext ?? []).map((concept) => `${fields.conceptIds}:${concept.key}`),
      ...Array.from(groupConceptsByVocabulary(search.conceptFilter).values(), (concepts) =>
        concepts.map((concept) => `${fields.conceptIds}:${concept.key}`),
      ),
      ...(availability.length > 0 ? [availability] : []),
    ];
  }

  /**
   * The numeric filters of the ranges, the price and the rating. Algolia ANDs them.
   *
   * The price is kept in minor units as the lowest and highest price of the variants of a product, so a price range is applied as an overlap:
   * a product matches when its highest price is at least the lowest wanted and its lowest price at most the highest wanted. That is exact
   * for products with one price, and for products with several it matches when the range touches the span between the lowest and the highest,
   * even if no single variant is priced inside it. The rating is the average rounded down, whole stars, both ends inclusive.
   */
  protected numericFiltersOf(payload: ProductSearchQueryByTerm): string[] {
    const { fields } = this.facetPolicy;
    const { priceFilter, ratingFilter, ranges } = payload.search;
    const currency = this.context.languageContext.currencyCode;
    return [
      // Every bound is a numeric filter of its own
      ...(ranges ?? []).flatMap((range) => [
        ...(range.min !== undefined ? [`${range.facet.key}>=${range.min}`] : []),
        ...(range.max !== undefined ? [`${range.facet.key}<=${range.max}`] : []),
      ]),
      ...(priceFilter?.min !== undefined ? [`${fields.priceMax}>=${toMinorUnits(priceFilter.min, currency)}`] : []),
      ...(priceFilter?.max !== undefined ? [`${fields.priceMin}<=${toMinorUnits(priceFilter.max, currency)}`] : []),
      ...(ratingFilter?.min !== undefined ? [`${fields.rating}>=${ratingFilter.min}`] : []),
      ...(ratingFilter?.max !== undefined ? [`${fields.rating}<=${ratingFilter.max}`] : []),
    ];
  }

  protected queryByTermPayload(payload: ProductSearchQueryByTerm) {
    const categoryFacet =
      payload.search.facets.find((x) => x.facet.key === 'categories') ||
      payload.search.categoryFilter;

    const finalFilters = [...(payload.search.filters || [])];

    if (categoryFacet) {
      finalFilters.push(`categories:"${categoryFacet.key}"`);
    }

    const numericFilters = this.numericFiltersOf(payload);
    const rulesContext = this.ruleContextsOf(payload.personalizationProfile);
    const optionalFilters = this.optionalFiltersOf(payload.personalizationProfile);

    return {
      indexName: getProductIndexNameForLocale(this.config.indexName, this.context.languageContext.locale, this.config),
      query: payload.search.term,
      page: payload.search.paginationOptions.pageNumber - 1,
      hitsPerPage: payload.search.paginationOptions.pageSize,
      facets: ['*'],
      analytics: true,
      clickAnalytics: true,
      facetFilters: this.facetFiltersOf(payload),
      filters: finalFilters.join(' AND '),
      ...(numericFilters.length > 0 ? { numericFilters } : {}),
      ruleContexts: rulesContext,
      ...(optionalFilters.length > 0 ? { optionalFilters } : {}),
      userToken: payload.personalizationProfile?.identifier.key || 'anonymous',
    } satisfies SearchQuery;
  }

  /** The multiselect facets that have a selected value, and so need a request of their own to offer their siblings. */
  protected multiselectKeysWithSelection(payload: ProductSearchQueryByTerm): string[] {
    const { multi } = groupFacetSelections(payload.search.facets, this.facetPolicy.multiselect);
    return Array.from(multi.keys());
  }

  /** The search as if no value of the facet were selected. */
  protected withoutSelectionOf(payload: ProductSearchQueryByTerm, facetKey: string): ProductSearchQueryByTerm {
    return {
      ...payload,
      search: {
        ...payload.search,
        facets: payload.search.facets.filter((x) => x.facet.key !== facetKey),
      },
    };
  }

  /** The vocabularies that have a concept selected, and so need a request of their own to offer the other concepts. */
  protected conceptVocabulariesWithSelection(payload: ProductSearchQueryByTerm): string[] {
    return Array.from(groupConceptsByVocabulary(payload.search.conceptFilter).keys());
  }

  /** The search as if no concept of the vocabulary were selected. */
  protected withoutConceptsOf(payload: ProductSearchQueryByTerm, vocabulary: string): ProductSearchQueryByTerm {
    const remaining = (payload.search.conceptFilter ?? []).filter((concept) => getConceptVocabulary(concept) !== vocabulary);
    return { ...payload, search: { ...payload.search, conceptFilter: remaining.length > 0 ? remaining : undefined } };
  }

  /** The numeric facets the search is restricted on, once each. */
  protected rangeKeysOf(payload: ProductSearchQueryByTerm): string[] {
    const restricted = (payload.search.ranges ?? []).filter((range) => range.min !== undefined || range.max !== undefined);
    return Array.from(new Set(restricted.map((range) => range.facet.key)));
  }

  /** The search as if it had no ranges. */
  protected withoutRangesOf(payload: ProductSearchQueryByTerm): ProductSearchQueryByTerm {
    return { ...payload, search: { ...payload.search, ranges: undefined } };
  }

  /**
   * A request that returns the facets of a search that is not the main one. It is kept out of the analytics, so that it neither counts as a
   * search nor gets a queryID of its own. Only its facets are used: it asks for one hit because the result schema needs a page size of at
   * least 1, and a response with no page size would not parse.
   */
  protected facetCountPayload(search: ProductSearchQueryByTerm, fields: string[]) {
    return {
      ...this.queryByTermPayload(search),
      page: 0,
      hitsPerPage: 1,
      facets: fields,
      analytics: false,
      clickAnalytics: false,
    } satisfies SearchQuery;
  }

  /** The request that returns the values and counts of one multiselect facet as if none of its values were selected. */
  protected siblingFacetPayload(payload: ProductSearchQueryByTerm, facetKey: string) {
    return this.facetCountPayload(this.withoutSelectionOf(payload, facetKey), [facetKey]);
  }

  /** The request that returns the stats of the numeric facets that are restricted by a range, as the search has them without its ranges. */
  protected rangeBoundsPayload(payload: ProductSearchQueryByTerm, facetKeys: string[]) {
    return this.facetCountPayload(this.withoutRangesOf(payload), facetKeys);
  }

  /**
   * The searches that offer what the selection of the main search hides, one for each of:
   * - an attribute facet of the policy's multiselect with a value selected: its values without its selection
   * - a vocabulary with a concept selected: its concepts without its selection
   * - the rating, with a ratingFilter: all buckets
   * - the availability, with an availabilityFilter: online and all stores
   * - the price, with a priceFilter: the stats without it, so that a slider keeps its bounds
   * - the numeric attributes with a range: their stats without the ranges
   */
  protected facetCountSearchesOf(payload: ProductSearchQueryByTerm): AlgoliaFacetCountSearch[] {
    const { fields } = this.facetPolicy;
    const search = payload.search;
    const searches: AlgoliaFacetCountSearch[] = [];

    for (const key of this.multiselectKeysWithSelection(payload)) {
      searches.push({ mode: 'replace', search: this.withoutSelectionOf(payload, key), ids: [attributeFacetId(key)], fields: [key] });
    }
    for (const vocabulary of this.conceptVocabulariesWithSelection(payload)) {
      searches.push({
        mode: 'replace',
        search: this.withoutConceptsOf(payload, vocabulary),
        ids: [taxonomyFacetId(vocabulary)],
        fields: [`${fields.conceptFacetPrefix}${vocabulary}`],
      });
    }
    if (search.ratingFilter?.min !== undefined || search.ratingFilter?.max !== undefined) {
      searches.push({
        mode: 'replace',
        search: { ...payload, search: { ...search, ratingFilter: undefined } },
        ids: ['rating'],
        fields: [fields.rating],
      });
    }
    if (search.availabilityFilter?.online === true || (search.availabilityFilter?.stores?.length ?? 0) > 0) {
      searches.push({
        mode: 'replace',
        search: { ...payload, search: { ...search, availabilityFilter: undefined } },
        ids: ['availability'],
        fields: [fields.online, fields.stores],
      });
    }
    if (search.priceFilter?.min !== undefined || search.priceFilter?.max !== undefined) {
      searches.push({
        mode: 'stats',
        search: { ...payload, search: { ...search, priceFilter: undefined } },
        ids: ['price'],
        fields: [fields.priceMin, fields.priceMax],
      });
    }
    const rangeKeys = this.rangeKeysOf(payload);
    if (rangeKeys.length > 0) {
      searches.push({ mode: 'stats', search: this.withoutRangesOf(payload), ids: rangeKeys.map(attributeFacetId), fields: rangeKeys });
    }
    return searches;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const problem = getSearchFilterProblem(
      payload.search,
      ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'],
      this.facetPolicy,
    );
    if (problem !== undefined) {
      return error<InvalidInputError>({ type: 'InvalidInput', error: problem });
    }

    const client = algoliasearch(this.config.appId, this.config.apiKey);

    // The main request is the first, and the only one that counts for the analytics: its queryID is the one of the result. Next to it go
    // the searches that offer what the selection hides. Only their facets are used.
    const extra = this.facetCountSearchesOf(payload);
    const remote = await client.search<AlgoliaNativeRecord>({
      requests: [
        this.queryByTermPayload(payload),
        ...extra.map((x) => this.facetCountPayload(x.search, x.fields)),
      ],
    });

    const input = remote.results[0];
    const result = this.factory.parseSearchResult(this.context, input, payload);

    if (extra.length > 0) {
      const facetsOf = (index: number) => {
        const { search, ids } = extra[index];
        return this.factory
          .parseSearchResult(this.context, remote.results[index + 1], search)
          .facets.filter((facet) => ids.includes(getSearchFacetId(facet)));
      };
      const replacements = extra.flatMap((x, index) => (x.mode === 'replace' ? facetsOf(index) : []));
      const withStats = extra.flatMap((x, index) => (x.mode === 'stats' ? facetsOf(index) : []));
      const merged = withFacetStats(replaceFacets(result.facets, replacements), withStats);
      markSelectedFacets(merged, payload.search);
      result.facets = orderSearchFacets(merged, this.facetPolicy);
    }

    return success(result);
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    } satisfies Partial<FacetIdentifier>);

    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath.map((c) => c.name).join(' > '),
    } satisfies Partial<FacetValueIdentifier>);

    return success(facetValueIdentifier);
  }
}
