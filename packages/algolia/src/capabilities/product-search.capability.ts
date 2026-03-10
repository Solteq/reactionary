import {
  type Cache,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
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
  success,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaNativeRecord } from '../schema/search.schema.js';
import type { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';

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

  protected queryByTermPayload(payload: ProductSearchQueryByTerm) {
    const facetsThatAreNotCategory = payload.search.facets.filter(
      (x) => x.facet.key !== 'categories',
    );
    const categoryFacet =
      payload.search.facets.find((x) => x.facet.key === 'categories') ||
      payload.search.categoryFilter;

    const finalFilters = [...(payload.search.filters || [])];

    const finalFacetFilters = [
      ...facetsThatAreNotCategory.map((x) => `${x.facet.key}:${x.key}`),
    ];

    if (categoryFacet) {
      finalFilters.push(`categories:"${categoryFacet.key}"`);
    }

    return {
      indexName: this.config.indexName,
      query: payload.search.term,
      page: payload.search.paginationOptions.pageNumber - 1,
      hitsPerPage: payload.search.paginationOptions.pageSize,
      facets: ['*'],
      analytics: true,
      clickAnalytics: true,
      facetFilters: finalFacetFilters,
      filters: finalFilters.join(' AND '),
    };
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const remote = await client.search<AlgoliaNativeRecord>({
      requests: [this.queryByTermPayload(payload)],
    });

    const input = remote.results[0];
    const result = this.factory.parseSearchResult(this.context, input, payload);

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
