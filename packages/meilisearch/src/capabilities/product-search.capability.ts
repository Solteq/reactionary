import {
  DEFAULT_AFFINITY_BAND_WEIGHTS,
  type Cache,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
  error,
  fromMinorUnits,
  getConceptVocabulary,
  attributeFacetId,
  getSearchFacetId,
  taxonomyFacetId,
  getSearchFilterProblem,
  getVocabularyName,
  groupConceptsByVocabulary,
  groupFacetSelections,
  type InvalidInputError,
  orderSearchFacets,
  toMinorUnits,
  type ProductSearchResultAttributeFacet,
  ProductSearchResultAttributeFacetSchema,
  type ProductSearchResultAvailabilityFacet,
  ProductSearchResultAvailabilityFacetSchema,
  type ProductSearchResultPriceFacet,
  ProductSearchResultPriceFacetSchema,
  type ProductSearchResultRatingFacet,
  ProductSearchResultRatingFacetSchema,
  type ProductSearchResultTaxonomyFacet,
  ProductSearchResultTaxonomyFacetSchema,
  ImageSchema,
  ProductSearchCapability,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryCreateNavigationFilter,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  ProductSearchResultFacetValueSchema,
  type ProductSearchResultItem,
  type ProductSearchResultItemComplianceData,
  ProductSearchResultItemComplianceDataSchema,
  type ProductSearchResultItemVariant,
  ProductSearchResultItemVariantSchema,
  type PersonalizationProfile,
  type AffinityRanking,
  type SearchPersonalizationMode,
  searchPersonalizationModeOf,
  createSearchFacetPolicy,
  getTaxonomyFacetName,
  isHiddenSearchFacet,
  type SearchFacetPolicy,
  parseSearchDocumentTaxonomy,
  ProductSearchResultSchema,
  Reactionary,
  replaceFacets,
  type RequestContext,
  type Result,
  success,
  withFacetStats,
} from '@reactionary/core';
import { Meilisearch, type SearchParams, type SearchResponse } from 'meilisearch';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';
import type { MeilisearchNativeRecord, MeilisearchNativeVariant } from '../schema/search.schema.js';
import type { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which the affinities of the profile carry. */
const AFFINITY_SEGMENT = /^affinity\./;

/** Alphabetical by code point, so the order never depends on the locale of the server. */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** What a group of selections needs to offer the values its own selection hides: the search without the selection, and the facets to read. */
export interface MeilisearchSiblingGroup {
  /** The search as if nothing were selected in the group. */
  search: ProductSearchQueryByTerm;
  /** The index fields to ask the facet distribution of. */
  facetKeys: string[];
  /** The ids (see getSearchFacetId) of the result facets that are taken from the answer. */
  ids: string[];
}

/** The typed filters this provider applies. */
const SUPPORTED_TYPED_FILTERS = ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'] as const;

export class MeilisearchProductSearchCapability<
  TFactory extends ProductSearchFactory = MeilisearchProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MeilisearchConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;
  protected facetPolicy: SearchFacetPolicy;
  /** Who personalizes a search: the engine (Meilisearch's own, the default), the `ranking` below, or nobody. */
  protected personalizationMode: SearchPersonalizationMode;
  private rankingOfVisitors?: AffinityRanking;

  constructor(
    config: MeilisearchConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.facetPolicy = createSearchFacetPolicy(config.facets);
    this.personalizationMode = searchPersonalizationModeOf(config.personalization);
  }

  /**
   * Escapes a value for use between double quotes in a Meilisearch filter expression. A backslash escapes the
   * following character inside a quoted string, so both the backslash and the double quote must be escaped, or the
   * value can close the string and append filter clauses of its own.
   */
  protected escapeFilterValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /** The longest user context sent: Meilisearch's personalization reads it as free text. */
  protected readonly maxUserContextLength: number = 500;

  /** The most concepts named as a strong interest. */
  protected readonly maxStrongInterests: number = 5;

  /**
   * How a concept is named in the user context. The last part of its id, as words: `features/cordless` is "cordless" and
   * `application/power-tools` is "power tools". Override it to use the localized name of the concept, say.
   */
  protected conceptNameOf(conceptId: string): string {
    const slug = conceptId.split('/').pop() ?? conceptId;
    return slug.replace(/[-_]+/g, ' ').trim();
  }

  /**
   * The strong interests of a visitor for the user context, named: the concepts of the high band, at most `maxStrongInterests`, by concept
   * id. The lower bands are weak signal and left out. A name is there once.
   */
  protected strongInterestsOf(profile: Pick<PersonalizationProfile, 'affinities'>): string[] {
    const { high } = DEFAULT_AFFINITY_BAND_WEIGHTS;
    const names = Object.entries(profile.affinities ?? {})
      .flatMap(([id, weight]): string[] => (typeof weight === 'number' && weight >= high ? [id] : []))
      .sort(byCodePoint)
      .map((id) => this.conceptNameOf(id))
      .filter((name) => name !== '');
    return [...new Set(names)].slice(0, this.maxStrongInterests);
  }

  /**
   * The segments the user context lists: all of them but the affinity segments, which the strong interests say better, alphabetically,
   * so the same profile always gives the same text.
   */
  protected userContextSegmentsOf(profile: Pick<PersonalizationProfile, 'segments'>): string[] {
    return [...new Set((profile.segments ?? []).filter((segment) => !AFFINITY_SEGMENT.test(segment)))].sort(byCodePoint);
  }

  /**
   * The text Meilisearch's personalization ranks by (`personalize.userContext`), or undefined when there is nothing to say of the visitor.
   * In this order:
   * 1. The blurb of the profile, when it has one.
   * 2. The strong interests, in words: "Strong interest in: cordless, power tools".
   * 3. All the other segments: "The customer is in the following segments: lapsed, vip".
   *
   * Past `maxUserContextLength` characters the rest is cut off, so it is the segments that go first.
   */
  protected userContextOf(profile: Pick<PersonalizationProfile, 'blurb' | 'segments' | 'affinities'> | undefined): string | undefined {
    if (!profile) {
      return undefined;
    }
    const parts: string[] = [];

    const blurb = (profile.blurb ?? '').trim();
    if (blurb) {
      parts.push(blurb);
    }
    const strong = this.strongInterestsOf(profile);
    if (strong.length > 0) {
      parts.push('Strong interest in: ' + strong.join(', '));
    }
    const segments = this.userContextSegmentsOf(profile);
    if (segments.length > 0) {
      parts.push('The customer is in the following segments: ' + segments.join(', '));
    }

    const text = parts.join('. ');
    return text === '' ? undefined : text.slice(0, this.maxUserContextLength);
  }

  protected queryByTermPayload(payload: ProductSearchQueryByTerm) {

    const facetsThatAreNotCategory = payload.search.facets.filter(x => x.facet.key !== 'categories');
    const categoryFacet = payload.search.facets.find(x => x.facet.key === 'categories') || payload.search.categoryFilter;

    // Each filter is a complete expression. Parenthesised, so that an OR in one cannot take over the AND that joins it to
    // the restrictions below. They are raw Meilisearch expressions and must come from the application, never from user input.
    const finalFilters: string[] = (payload.search.filters || []).map((f) => `(${f})`);

    // Meilisearch ANDs the expressions of the filter. A multiselect facet is one parenthesised group with an OR between its values.
    const selections = groupFacetSelections(facetsThatAreNotCategory, this.facetPolicy.multiselect);
    const equals = (x: FacetValueIdentifier) => `"${this.escapeFilterValue(x.facet.key)}"="${this.escapeFilterValue(x.key)}"`;
    // Every bound of a range is an expression of its own
    const bounds = (payload.search.ranges ?? []).flatMap((range) => {
      const attribute = `"${this.escapeFilterValue(range.facet.key)}"`;
      return [
        ...(range.min !== undefined ? [`${attribute} >= ${range.min}`] : []),
        ...(range.max !== undefined ? [`${attribute} <= ${range.max}`] : []),
      ];
    });
    const finalFacetFilters: string[] = [
      ...selections.single.map(equals),
      ...Array.from(selections.multi.values(), (values) => `(${values.map(equals).join(' OR ')})`),
      ...bounds,
      ...this.typedFiltersOf(payload),
    ];

    if (categoryFacet) {
      finalFilters.push(`categories = "${this.escapeFilterValue(categoryFacet.key)}"`);
    }

    // Combine all filters
    let filterString: string | undefined;
    if (finalFilters.length > 0 || finalFacetFilters.length > 0) {
      const allFilters = [...finalFilters, ...finalFacetFilters];
      filterString = allFilters.join(' AND ');
    }

    const searchOptions: SearchParams = {
      offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
      limit: payload.search.paginationOptions.pageSize,
      facets: ['*'],
      filter: filterString,
    };

    if (this.config.useAIEmbedding) {
      searchOptions.hybrid = {
        embedder: this.config.useAIEmbedding,
        semanticRatio: this.config.semanticRatio, // This can be adjusted based on how much weight you want to give to semantic relevance vs keyword matching
      };
    }

    // In affinity mode the ranking starts from how well Meilisearch matched each hit
    if (this.personalizationMode === 'affinity') {
      searchOptions.showRankingScore = true;
    }

    // Only in engine mode: in affinity mode Reactionary personalizes the page itself, and the engine ranking by the same interests as well
    // would count them twice
    const userContext = this.personalizationMode === 'engine' ? this.userContextOf(payload.personalizationProfile) : undefined;
    if (userContext) {
      Object.assign(searchOptions, { personalize: { userContext } });
    }
    return searchOptions;
  }

  /**
   * The expressions of the typed filters, all hard filters that are ANDed with everything else.
   * - conceptContext: every concept must match. conceptIds holds the ancestors of the concepts, so the products of the descendants match too.
   * - conceptFilter: any concept of a vocabulary (parenthesised OR), all vocabularies.
   * - priceFilter: the product has a price in the range, approximated from the lowest and highest price of the product: the highest is at least
   *   the minimum and the lowest at most the maximum. A product whose prices lie on both sides of the range, with none in it, matches too.
   *   The amounts are converted to the minor units the index keeps, in the currency of the request.
   * - ratingFilter: the floored average rating, whole stars, both ends inclusive.
   * - availabilityFilter: online or in stock in any of the stores.
   */
  protected typedFiltersOf(payload: ProductSearchQueryByTerm): string[] {
    const { fields } = this.facetPolicy;
    const search = payload.search;
    const quote = (value: string) => `"${this.escapeFilterValue(value)}"`;
    const filters: string[] = [];

    for (const concept of search.conceptContext ?? []) {
      filters.push(`${quote(fields.conceptIds)} = ${quote(concept.key)}`);
    }
    for (const concepts of groupConceptsByVocabulary(search.conceptFilter).values()) {
      filters.push(`(${concepts.map((concept) => `${quote(fields.conceptIds)} = ${quote(concept.key)}`).join(' OR ')})`);
    }
    const currency = this.context.languageContext.currencyCode;
    if (search.priceFilter?.min !== undefined) {
      filters.push(`${quote(fields.priceMax)} >= ${toMinorUnits(search.priceFilter.min, currency)}`);
    }
    if (search.priceFilter?.max !== undefined) {
      filters.push(`${quote(fields.priceMin)} <= ${toMinorUnits(search.priceFilter.max, currency)}`);
    }
    if (search.ratingFilter?.min !== undefined) {
      filters.push(`${quote(fields.rating)} >= ${search.ratingFilter.min}`);
    }
    if (search.ratingFilter?.max !== undefined) {
      filters.push(`${quote(fields.rating)} <= ${search.ratingFilter.max}`);
    }
    const availability = [
      ...(search.availabilityFilter?.online === true ? [`${quote(fields.online)} = true`] : []),
      ...(search.availabilityFilter?.stores ?? []).map((store) => `${quote(fields.stores)} = ${quote(store.key)}`),
    ];
    if (availability.length > 0) {
      filters.push(`(${availability.join(' OR ')})`);
    }
    return filters;
  }

  /**
   * The groups of selections that hide their own siblings, and so need a request of their own: the multiselect attribute facets that have a
   * value selected, every vocabulary that has a concept in the conceptFilter, the rating with a ratingFilter and availability with an
   * availabilityFilter.
   */
  protected siblingGroupsOf(payload: ProductSearchQueryByTerm): MeilisearchSiblingGroup[] {
    const { fields } = this.facetPolicy;
    const search = payload.search;
    const groups: MeilisearchSiblingGroup[] = [];

    for (const key of this.multiselectKeysWithSelection(payload)) {
      groups.push({ search: this.withoutSelectionOf(payload, key), facetKeys: [key], ids: [attributeFacetId(key)] });
    }
    for (const vocabulary of groupConceptsByVocabulary(search.conceptFilter).keys()) {
      const conceptFilter = (search.conceptFilter ?? []).filter((concept) => getConceptVocabulary(concept) !== vocabulary);
      groups.push({
        search: { ...payload, search: { ...search, conceptFilter } },
        facetKeys: [`${fields.conceptFacetPrefix}${vocabulary}`],
        ids: [taxonomyFacetId(vocabulary)],
      });
    }
    if (search.ratingFilter?.min !== undefined || search.ratingFilter?.max !== undefined) {
      groups.push({ search: { ...payload, search: { ...search, ratingFilter: undefined } }, facetKeys: [fields.rating], ids: ['rating'] });
    }
    if (search.availabilityFilter?.online === true || (search.availabilityFilter?.stores?.length ?? 0) > 0) {
      groups.push({
        search: { ...payload, search: { ...search, availabilityFilter: undefined } },
        facetKeys: [fields.online, fields.stores],
        ids: ['availability'],
      });
    }
    return groups;
  }

  /** The multiselect attribute facets that have a selected value. */
  protected multiselectKeysWithSelection(payload: ProductSearchQueryByTerm): string[] {
    const { multi } = groupFacetSelections(payload.search.facets, this.facetPolicy.multiselect);
    return Array.from(multi.keys());
  }

  /** The search as if no value of the attribute facet were selected. */
  protected withoutSelectionOf(payload: ProductSearchQueryByTerm, facetKey: string): ProductSearchQueryByTerm {
    return {
      ...payload,
      search: {
        ...payload.search,
        facets: payload.search.facets.filter((x) => x.facet.key !== facetKey),
      },
    };
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

  /** Whether the search restricts the price, so that the stats of the price must come from a search without the restriction. */
  protected hasPriceFilter(payload: ProductSearchQueryByTerm): boolean {
    return payload.search.priceFilter?.min !== undefined || payload.search.priceFilter?.max !== undefined;
  }

  /** The search as if it had no priceFilter. */
  protected withoutPriceFilterOf(payload: ProductSearchQueryByTerm): ProductSearchQueryByTerm {
    return { ...payload, search: { ...payload.search, priceFilter: undefined } };
  }

  /** The request of a sibling group: the values and counts as if nothing were selected in it, with no hits. Neither ranking nor personalization matters to it. */
  protected siblingFacetPayload(group: MeilisearchSiblingGroup): SearchParams {
    const request = this.queryByTermPayload({ ...group.search, personalizationProfile: undefined });
    return { ...request, offset: 0, limit: 0, facets: group.facetKeys, showRankingScore: false };
  }

  /**
   * The request that returns the stats of the numeric facets that are restricted by a range, as the search has them without its ranges,
   * with no hits.
   */
  protected rangeBoundsPayload(payload: ProductSearchQueryByTerm, facetKeys: string[]): SearchParams {
    const request = this.queryByTermPayload({ ...this.withoutRangesOf(payload), personalizationProfile: undefined });
    return { ...request, offset: 0, limit: 0, facets: facetKeys, showRankingScore: false };
  }

  /** The request for the price bounds as the search has them without its priceFilter, with no hits, so that a price slider keeps its bounds. */
  protected priceBoundsPayload(payload: ProductSearchQueryByTerm): SearchParams {
    const request = this.queryByTermPayload({ ...this.withoutPriceFilterOf(payload), personalizationProfile: undefined });
    return { ...request, offset: 0, limit: 0, facets: [this.facetPolicy.fields.priceMin, this.facetPolicy.fields.priceMax], showRankingScore: false };
  }

  // Not cached: the personalization profile is part of the payload, and with it the cache key, so a search is cached per visitor
  // and a profile that changes with every visit never finds its entry again.
  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const problem = getSearchFilterProblem(payload.search, SUPPORTED_TYPED_FILTERS, this.facetPolicy);
    if (problem !== undefined) {
      return error<InvalidInputError>({ type: 'InvalidInput', error: problem });
    }

    const client = new Meilisearch({
      host: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });

    const index = client.index(getProductIndexNameForLocale(this.config.indexName, this.context.languageContext.locale));

    // The search itself, and next to it the searches that offer what the selection hides: the values of a group (multiselect attribute,
    // vocabulary, rating, availability) from the search without its selection, the stats of the ranged facets from the search without its
    // ranges, and the price bounds from the search without its priceFilter. They run side by side.
    const siblings = this.siblingGroupsOf(payload).map((group) => ({ group, request: this.siblingFacetPayload(group) }));
    const rangeKeys = this.rangeKeysOf(payload);
    const bounds =
      rangeKeys.length > 0
        ? { search: this.withoutRangesOf(payload), request: this.rangeBoundsPayload(payload, rangeKeys) }
        : undefined;
    const price = this.hasPriceFilter(payload)
      ? { search: this.withoutPriceFilterOf(payload), request: this.priceBoundsPayload(payload) }
      : undefined;
    const [remote, ...responses] = await Promise.all([
      index.search<MeilisearchNativeRecord>(payload.search.term, this.queryByTermPayload(payload)),
      ...siblings.map((sibling) => index.search<MeilisearchNativeRecord>(payload.search.term, sibling.request)),
      ...(bounds ? [index.search<MeilisearchNativeRecord>(payload.search.term, bounds.request)] : []),
      ...(price ? [index.search<MeilisearchNativeRecord>(payload.search.term, price.request)] : []),
    ]);
    let parsed = this.parsePaginatedResult(remote, payload);
    if (siblings.length > 0 || bounds || price) {
      const facetsOf = (response: SearchResponse<MeilisearchNativeRecord>, search: ProductSearchQueryByTerm, ids: string[]) =>
        this.parsePaginatedResult(response, search).facets.filter((facet) => ids.includes(getSearchFacetId(facet)));
      const siblingFacets = siblings.flatMap((sibling, i) => facetsOf(responses[i], sibling.group.search, sibling.group.ids));
      const boundsFacets = bounds ? facetsOf(responses[siblings.length], bounds.search, rangeKeys.map(attributeFacetId)) : [];
      const priceFacets = price ? facetsOf(responses[siblings.length + (bounds ? 1 : 0)], price.search, ['price']) : [];
      parsed = {
        ...parsed,
        facets: withFacetStats(withFacetStats(replaceFacets(parsed.facets, siblingFacets), boundsFacets), priceFacets),
      };
    }
    // Active is marked from the search itself, after the merge: the siblings were searched without their selection.
    // The order of the policy comes last, as a facet it leaves out must still be there for the merge.
    const result = this.personalize(
      { ...parsed, facets: orderSearchFacets(this.markActive(parsed.facets, payload), this.facetPolicy) },
      payload,
    );

    return success(this.factory.parseSearchResult(this.context, result, payload));
  }

  /**
   * Reorders the page by the interests of the visitor in `affinity` mode. Made on first use by `createSearchRanking`, which a subclass overrides
   * to change it: that way the fields of the subclass are set when it runs.
   */
  protected get ranking(): AffinityRanking {
    const options = this.config.personalization;
    this.rankingOfVisitors ??= this.createSearchRanking(options?.mode === 'affinity' ? options : undefined);
    return this.rankingOfVisitors;
  }

  /**
   * The page, reordered by the interests of the visitor in `affinity` mode. In the other modes it is as the engine returned it: the engine
   * has already personalized it (`engine`) or nobody does (`none`). Only the page of the engine is reordered: a hit on another page is not
   * pulled in, and a page boundary is a boundary.
   */
  protected personalize(result: ProductSearchResult, payload: ProductSearchQueryByTerm): ProductSearchResult {
    if (this.personalizationMode !== 'affinity') {
      return result;
    }
    return { ...result, items: this.ranking.rank(result.items, payload.personalizationProfile) };
  }

  public override async createCategoryNavigationFilter(payload: ProductSearchQueryCreateNavigationFilter): Promise<Result<FacetValueIdentifier>> {

    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories'
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath.map(c => c.name).join(' > ')
    });
    return success(facetValueIdentifier);
  }

  protected parseComplianceData(data: MeilisearchNativeRecord): ProductSearchResultItemComplianceData {
    return data.complianceData ?? ProductSearchResultItemComplianceDataSchema.parse({});
  }

  protected parseSingle(body: MeilisearchNativeRecord) {
    const variants = [...(body.variants || [])].map(variant => this.parseVariant(variant, body));
    const product = {
      identifier: { key: body.objectID },
      name: body.name || body.objectID,
      slug: body.slug || body.objectID,
      complianceData: this.parseComplianceData(body),
      ...parseSearchDocumentTaxonomy(body),
      ...(typeof body._rankingScore === 'number' ? { relevance: Math.min(1, Math.max(0, body._rankingScore)) } : {}),
      canAddToCartDirectly: body.canAddToCartDirectly ?? variants.length === 1,
      variants,
    } satisfies ProductSearchResultItem;

    return product;
  }

  protected parseVariant(
    variant: MeilisearchNativeVariant,
    product: MeilisearchNativeRecord,
  ): ProductSearchResultItemVariant {
    const result = ProductSearchResultItemVariantSchema.parse({
      variant: {
        sku: variant.sku
      },
      image: ImageSchema.parse({
        sourceUrl: variant.image,
        altText: product.name || '',
      })
    } satisfies Partial<ProductSearchResultItemVariant>);

    return result;
  }

  protected parsePaginatedResult(body: SearchResponse<MeilisearchNativeRecord>, query: ProductSearchQueryByTerm) {
    const items = body.hits.map((hit) => this.parseSingle(hit));
    let facets: ProductSearchResultAttributeFacet[] = [];
    const taxonomy: ProductSearchResultTaxonomyFacet[] = [];
    const { fields } = this.facetPolicy;
    const distribution = body.facetDistribution ?? {};

    for (const id in distribution) {
      const f = distribution[id];
      if (id === fields.rating || id === fields.online || id === fields.stores || id === fields.priceMin || id === fields.priceMax) {
        continue; // built below, from the typed fields
      }
      if (id.startsWith(fields.conceptFacetPrefix)) {
        const facet = this.parseTaxonomyFacet(id.slice(fields.conceptFacetPrefix.length), f);
        if (facet.values.length > 0) {
          taxonomy.push(facet);
        }
        continue;
      }
      // facets: ['*'] also returns the facets that must never reach the storefront
      if (isHiddenSearchFacet(id, this.facetPolicy)) {
        continue;
      }
      const facetId = FacetIdentifierSchema.parse({
        key: id
      });
      const facet = this.parseFacet(facetId, f);
      const stats = body.facetStats?.[id];
      if (typeof stats?.min === 'number' && typeof stats.max === 'number') {
        facet.stats = { min: stats.min, max: stats.max };
      }
      if (facet.values.length > 0) {
        facets.push(facet);
      }
    }

    const typed: ProductSearchResultFacet[] = [
      ...taxonomy,
      ...this.compact(this.parsePriceFacet(body)),
      ...this.compact(this.parseRatingFacet(distribution[fields.rating])),
      ...this.compact(this.parseAvailabilityFacet(distribution[fields.online], distribution[fields.stores])),
    ];

    // Handle category hierarchy similar to Algolia
    const selectedCategoryFacet = query.search.facets.find(x => x.facet.key === 'categories') || query.search.categoryFilter;
    let subCategoryFacet: ProductSearchResultAttributeFacet | undefined;
    if (selectedCategoryFacet) {
      const valueDepth = selectedCategoryFacet.key.split(' > ').length;
      subCategoryFacet = facets.find(f => f.identifier.key === `hierarchy.lvl${valueDepth}`);
    } else {
      subCategoryFacet = facets.find(f => f.identifier.key === 'hierarchy.lvl0');
    }

    if (subCategoryFacet) {
      // remap to 'categories' facet
      subCategoryFacet.identifier = FacetIdentifierSchema.parse({
        key: 'categories'
      });
      subCategoryFacet.name = 'Categories';
      subCategoryFacet.multiselect = false;
      for (const v of subCategoryFacet.values) {
        const pathParts = v.identifier.key.split(' > ');
        v.identifier.facet = subCategoryFacet.identifier;
        v.name = pathParts[pathParts.length - 1];
      }
    }

    // remove other hierarchy facets
    facets = facets.filter(f => !f.identifier.key.startsWith('hierarchy.lvl'));
    const totalPages = Math.ceil((body.estimatedTotalHits || 0) / query.search.paginationOptions.pageSize);

    const result = {
      identifier: {
        term: query.search.term,
        facets: query.search.facets,
        ...(query.search.ranges ? { ranges: query.search.ranges } : {}),
        ...(query.search.conceptContext ? { conceptContext: query.search.conceptContext } : {}),
        ...(query.search.conceptFilter ? { conceptFilter: query.search.conceptFilter } : {}),
        ...(query.search.priceFilter ? { priceFilter: query.search.priceFilter } : {}),
        ...(query.search.ratingFilter ? { ratingFilter: query.search.ratingFilter } : {}),
        ...(query.search.availabilityFilter ? { availabilityFilter: query.search.availabilityFilter } : {}),
        filters: query.search.filters,
        paginationOptions: query.search.paginationOptions,
      },
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: body.estimatedTotalHits || 0,
      totalPages: totalPages,
      items: items,
      facets: [...facets, ...typed],
    } satisfies ProductSearchResult;

    return result;
  }

  protected parseFacet(facetIdentifier: FacetIdentifier, facetValues: Record<string, number>): ProductSearchResultAttributeFacet {
    const result = ProductSearchResultAttributeFacetSchema.parse({
      semantic: 'attribute',
      multiselect: this.facetPolicy.multiselect.includes(facetIdentifier.key) && facetIdentifier.key !== 'categories',
      identifier: facetIdentifier,
      name: getTaxonomyFacetName(facetIdentifier.key, this.facetPolicy) ?? facetIdentifier.key.replace(/_/g, ' '),
      values: []
    });

    // never return the categories facet raw, as its only used for navigation and should be remapped to the hierarchy facet
    if (facetIdentifier.key === 'categories') {
      return result;
    }

    for (const vid in facetValues) {
      const fv = facetValues[vid];

      const facetValueIdentifier = FacetValueIdentifierSchema.parse({
        facet: facetIdentifier,
        key: vid
      } satisfies Partial<FacetValueIdentifier>);

      result.values.push(this.parseFacetValue(facetValueIdentifier, vid, fv));
    }
    return result;
  }

  /** A list of at most one facet, for spreading. */
  private compact<T extends ProductSearchResultFacet>(facet: T | undefined): T[] {
    return facet ? [facet] : [];
  }

  /** The name of a typed facet: the policy wins over the default. */
  protected typedFacetName(keys: string[], fallback: string): string {
    for (const key of keys) {
      const name = this.facetPolicy.names[key];
      if (name !== undefined) {
        return name;
      }
    }
    return fallback;
  }

  /**
   * The facet of a vocabulary from the values of `conceptFacets.<vocabulary>`, each "<concept id>|<localized name>". Split on the first "|":
   * the id is a concept key and has none. A value without one is the id itself, named after the last part of it.
   */
  protected parseTaxonomyFacet(vocabulary: string, values: Record<string, number>): ProductSearchResultTaxonomyFacet {
    const engineKey = `${this.facetPolicy.fields.conceptFacetPrefix}${vocabulary}`;
    return ProductSearchResultTaxonomyFacetSchema.parse({
      semantic: 'taxonomy',
      vocabulary,
      name: this.typedFacetName([engineKey, `taxonomy:${vocabulary}`], getVocabularyName(vocabulary)),
      multiselect: true,
      values: Object.entries(values).map(([value, count]) => {
        const separator = value.indexOf('|');
        const id = separator >= 0 ? value.slice(0, separator) : value;
        const name = separator >= 0 ? value.slice(separator + 1) : (id.split('/').pop() ?? id);
        return { concept: { key: id }, name, count, active: false };
      }),
    });
  }

  /**
   * The price facet from the stats of the price fields: the lowest of the lowest prices and the highest of the highest, in decimal amounts.
   * Undefined when the engine has no stats, that is when nothing matched.
   */
  protected parsePriceFacet(body: SearchResponse<MeilisearchNativeRecord>): ProductSearchResultPriceFacet | undefined {
    const { priceMin, priceMax } = this.facetPolicy.fields;
    const low = body.facetStats?.[priceMin];
    const high = body.facetStats?.[priceMax];
    const min = typeof low?.min === 'number' ? low.min : typeof high?.min === 'number' ? high.min : undefined;
    const max = typeof high?.max === 'number' ? high.max : typeof low?.max === 'number' ? low.max : undefined;
    if (min === undefined || max === undefined) {
      return undefined;
    }
    const currency = this.context.languageContext.currencyCode;
    return ProductSearchResultPriceFacetSchema.parse({
      semantic: 'price',
      name: this.typedFacetName(['price'], 'Price'),
      currency,
      stats: { min: fromMinorUnits(min, currency), max: fromMinorUnits(max, currency) },
    });
  }

  /** One bucket per whole star, the highest first. */
  protected parseRatingFacet(values: Record<string, number> | undefined): ProductSearchResultRatingFacet | undefined {
    const buckets = Object.entries(values ?? {})
      .map(([key, count]) => ({ stars: Number(key), count }))
      .filter((bucket) => Number.isFinite(bucket.stars))
      .sort((a, b) => b.stars - a.stars)
      .map((bucket) => ({ min: bucket.stars, max: bucket.stars, count: bucket.count, active: false }));
    return buckets.length === 0
      ? undefined
      : ProductSearchResultRatingFacetSchema.parse({ semantic: 'rating', name: this.typedFacetName(['rating'], 'Rating'), buckets });
  }

  /** Online only when there is a count for true. */
  protected parseAvailabilityFacet(
    online: Record<string, number> | undefined,
    stores: Record<string, number> | undefined,
  ): ProductSearchResultAvailabilityFacet | undefined {
    const onlineCount = online?.['true'];
    const hasOnline = typeof onlineCount === 'number' && onlineCount > 0;
    const storeList = Object.entries(stores ?? {}).map(([store, count]) => ({ store: { key: store }, count, active: false }));
    if (!hasOnline && storeList.length === 0) {
      return undefined;
    }
    return ProductSearchResultAvailabilityFacetSchema.parse({
      semantic: 'availability',
      name: this.typedFacetName(['availability'], 'Availability'),
      ...(hasOnline ? { online: { count: onlineCount, active: false } } : {}),
      stores: storeList,
    });
  }

  /** Marks what the search has selected as active, and the price range as selected. */
  protected markActive(facets: ProductSearchResultFacet[], payload: ProductSearchQueryByTerm): ProductSearchResultFacet[] {
    const search = payload.search;
    const concepts = new Set((search.conceptFilter ?? []).map((concept) => concept.key));
    const stores = new Set((search.availabilityFilter?.stores ?? []).map((store) => store.key));
    const rating = search.ratingFilter;
    const inRating = (stars: number) => rating !== undefined && stars >= (rating.min ?? 0) && stars <= (rating.max ?? Infinity);
    const price = search.priceFilter;
    return facets.map((facet): ProductSearchResultFacet => {
      switch (facet.semantic) {
        case 'attribute': {
          const selected = search.facets.filter((x) => x.facet.key === facet.identifier.key).map((x) => x.key);
          return { ...facet, values: facet.values.map((v) => (selected.includes(v.identifier.key) ? { ...v, active: true } : v)) };
        }
        case 'taxonomy':
          return { ...facet, values: facet.values.map((v) => ({ ...v, active: concepts.has(v.concept.key) })) };
        case 'rating':
          return { ...facet, buckets: facet.buckets.map((b) => ({ ...b, active: inRating(b.min) && inRating(b.max) })) };
        case 'availability':
          return {
            ...facet,
            ...(facet.online ? { online: { ...facet.online, active: search.availabilityFilter?.online === true } } : {}),
            stores: facet.stores.map((s) => ({ ...s, active: stores.has(s.store.key) })),
          };
        case 'price':
          return price && (price.min !== undefined || price.max !== undefined) ? { ...facet, selected: price } : facet;
      }
    });
  }

  protected parseFacetValue(facetValueIdentifier: FacetValueIdentifier, label: string, count: number): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }
}
