import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  type Cache,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import type { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';

const debug = createDebug('reactionary:magento:search');

export class MagentoProductSearchCapability<
  TFactory extends ProductSearchFactory = MagentoProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const finalSearch = (payload.search.term || '').trim().replace('*', '');
    const pageSize = payload.search.paginationOptions.pageSize;
    const currentPage = payload.search.paginationOptions.pageNumber;

    const params = new URLSearchParams();

    let filterGroupIndex = 0;
    if (finalSearch) {
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][field]`,
        'name',
      );
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][value]`,
        `%${finalSearch}%`,
      );
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][condition_type]`,
        'like',
      );
      filterGroupIndex++;
    }

    if (payload.search.categoryFilter?.key) {
      debug(`Applying category filter: ${payload.search.categoryFilter.key}`);
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][field]`,
        'category_id',
      );
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][value]`,
        payload.search.categoryFilter.key,
      );
      params.set(
        `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][condition_type]`,
        'eq',
      );
      filterGroupIndex++;
    }

    params.set('searchCriteria[pageSize]', String(pageSize));
    params.set('searchCriteria[currentPage]', String(currentPage));

    const client = await this.magentoApi.getClient();
    const response = await client.store.product.search(params);

    const result = this.factory.parseSearchResult(this.context, response, payload);

    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.items?.length ?? 0} products (page ${currentPage} of ${(result as ProductSearchResult).totalPages})`,
      );
    }

    return success(result);
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    });

    return success(facetValueIdentifier);
  }

  protected parseFacetValue(
    _facetValueIdentifier: FacetValueIdentifier,
    _label: string,
    _count: number,
  ): ProductSearchResultFacetValue {
    throw new Error('Method not implemented.');
  }

  protected parseFacet(
    _facetIdentifier: FacetIdentifier,
    _facetValue: unknown,
  ): ProductSearchResultFacet {
    throw new Error('Method not implemented.');
  }

  protected parseVariant(): never {
    throw new Error('Method not implemented.');
  }
}
