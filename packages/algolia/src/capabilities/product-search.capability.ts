import {
  type Cache,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
  groupFacetSelections,
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
  success,
} from '@reactionary/core';
import { algoliasearch, type SearchQuery } from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaNativeRecord } from '../schema/search.schema.js';
import type { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';
import { AlgoliaPersonalization } from '../core/personalization.js';

export class AlgoliaProductSearchCapability<
  TFactory extends ProductSearchFactory = AlgoliaProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: AlgoliaConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: AlgoliaConfiguration,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
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

  protected queryByTermPayload(payload: ProductSearchQueryByTerm) {
    const facetsThatAreNotCategory = payload.search.facets.filter(
      (x) => x.facet.key !== 'categories',
    );
    const categoryFacet =
      payload.search.facets.find((x) => x.facet.key === 'categories') ||
      payload.search.categoryFilter;

    const finalFilters = [...(payload.search.filters || [])];

    // Algolia ANDs the entries of facetFilters and ORs the values of a nested array. A multiselect facet is one nested array.
    const selections = groupFacetSelections(facetsThatAreNotCategory, payload.search.multiselect);
    const finalFacetFilters: (string | string[])[] = [
      ...selections.single.map((x) => `${x.facet.key}:${x.key}`),
      ...Array.from(selections.multi.values(), (values) => values.map((x) => `${x.facet.key}:${x.key}`)),
    ];

    if (categoryFacet) {
      finalFilters.push(`categories:"${categoryFacet.key}"`);
    }

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
      facetFilters: finalFacetFilters,
      filters: finalFilters.join(' AND '),
      ruleContexts: rulesContext,
      ...(optionalFilters.length > 0 ? { optionalFilters } : {}),
      userToken: payload.personalizationProfile?.identifier.key || 'anonymous',
    } satisfies SearchQuery;
  }

  /** The multiselect facets that have a selected value, and so need a request of their own to offer their siblings. */
  protected multiselectKeysWithSelection(payload: ProductSearchQueryByTerm): string[] {
    const { multi } = groupFacetSelections(payload.search.facets, payload.search.multiselect);
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

  /**
   * The request that returns the values and counts of one multiselect facet as if none of its values were selected. It is kept out of the
   * analytics, so that it neither counts as a search nor gets a queryID of its own. Only its facets are used: it asks for one hit because
   * the result schema needs a page size of at least 1, and a response with no page size would not parse.
   */
  protected siblingFacetPayload(payload: ProductSearchQueryByTerm, facetKey: string) {
    const request = this.queryByTermPayload(this.withoutSelectionOf(payload, facetKey));
    return {
      ...request,
      page: 0,
      hitsPerPage: 1,
      facets: [facetKey],
      analytics: false,
      clickAnalytics: false,
    } satisfies SearchQuery;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    // The main request is the first, and the only one that counts for the analytics: its queryID is the one of the result.
    const siblingKeys = this.multiselectKeysWithSelection(payload);
    const remote = await client.search<AlgoliaNativeRecord>({
      requests: [
        this.queryByTermPayload(payload),
        ...siblingKeys.map((key) => this.siblingFacetPayload(payload, key)),
      ],
    });

    const input = remote.results[0];
    const result = this.factory.parseSearchResult(this.context, input, payload);

    if (siblingKeys.length > 0) {
      // Each of the others is the search without the selection of one multiselect facet: its values and counts are what that facet offers
      const siblingFacets = siblingKeys.flatMap(
        (key, index) =>
          this.factory.parseSearchResult(this.context, remote.results[index + 1], this.withoutSelectionOf(payload, key)).facets
            .filter((facet) => facet.identifier.key === key),
      );
      result.facets = replaceFacets(result.facets, siblingFacets);
    }

    for (const selectedFacet of payload.search.facets) {
      const facet = result.facets.find(
        (f) => f.identifier.key === selectedFacet.facet.key,
      );
      if (!facet) {
        continue;
      }
      const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
      if (value) {
        value.active = true;
      }
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
