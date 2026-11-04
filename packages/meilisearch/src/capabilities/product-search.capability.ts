import {
  DEFAULT_AFFINITY_BAND_WEIGHTS,
  type Cache,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
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
  ProductSearchResultFacetSchema,
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
  type RequestContext,
  type Result,
  success
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

    const finalFacetFilters: string[] = [
      ...facetsThatAreNotCategory.map(
        (x) => `"${this.escapeFilterValue(x.facet.key)}"="${this.escapeFilterValue(x.key)}"`
      ),
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

    // Only in engine mode: in affinity mode Reactionary personalizes the page itself, and the engine ranking by the same interests as well
    // would count them twice
    const userContext = this.personalizationMode === 'engine' ? this.userContextOf(payload.personalizationProfile) : undefined;
    if (userContext) {
      Object.assign(searchOptions, { personalize: { userContext } });
    }
    return searchOptions;
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
    const client = new Meilisearch({
      host: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });

    const index = client.index(getProductIndexNameForLocale(this.config.indexName, this.context.languageContext.locale));


    const remote = await index.search<MeilisearchNativeRecord>(payload.search.term, this.queryByTermPayload(payload) as SearchParams);
    const result = this.personalize(this.parsePaginatedResult(remote, payload), payload);

    // mark selected facets as active
    for (const selectedFacet of payload.search.facets) {
      const facet = result.facets.find((f) => f.identifier.key === selectedFacet.facet.key);
      if (facet) {
        const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
        if (value) {
          value.active = true;
        }
      }
    }

    return success(this.factory.parseSearchResult(this.context, result, payload));
  }

  /**
   * Reorders the page by the interests of the visitor in `affinity` mode. Made on first use by `createSearchRanking`, which a subclass overrides
   * to change it: that way the fields of the subclass are set when it runs.
   */
  protected get ranking(): AffinityRanking {
    this.rankingOfVisitors ??= this.createSearchRanking(this.config.personalization);
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
    let facets: ProductSearchResultFacet[] = [];

    if (body.facetDistribution) {
      for (const id in body.facetDistribution) {
        // facets: ['*'] also returns the facets that must never reach the storefront
        if (isHiddenSearchFacet(id, this.facetPolicy)) {
          continue;
        }
        const f = body.facetDistribution[id];
        const facetId = FacetIdentifierSchema.parse({
          key: id
        });
        const facet = this.parseFacet(facetId, f);
        if (facet.values.length > 0) {
          facets.push(facet);
        }
      }
    }

    // Handle category hierarchy similar to Algolia
    const selectedCategoryFacet = query.search.facets.find(x => x.facet.key === 'categories') || query.search.categoryFilter;
    let subCategoryFacet;
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
        filters: query.search.filters,
        paginationOptions: query.search.paginationOptions,
      },
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: body.estimatedTotalHits || 0,
      totalPages: totalPages,
      items: items,
      facets,
    } satisfies ProductSearchResult;

    return result;
  }

  protected parseFacet(facetIdentifier: FacetIdentifier, facetValues: Record<string, number>): ProductSearchResultFacet {
    const result: ProductSearchResultFacet = ProductSearchResultFacetSchema.parse({
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

  protected parseFacetValue(facetValueIdentifier: FacetValueIdentifier, label: string, count: number): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }
}
