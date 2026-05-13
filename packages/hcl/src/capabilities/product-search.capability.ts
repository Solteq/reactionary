import {
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchQueryCreateNavigationFilterSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  type Cache,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclProductSearchFactory } from '../factories/product-search/product-search.factory.js';

export class HclProductSearchCapability<
  TFactory extends ProductSearchFactory = HclProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const { term, facets, paginationOptions, categoryFilter } = payload.search;
    const { pageNumber, pageSize } = paginationOptions;

    const response = await this.client.findProducts({
      searchTerm: term || undefined,
      categoryId: categoryFilter?.key,
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      profileName: categoryFilter?.key
        ? this.config.profiles.categoryBrowse
        : this.config.profiles.productSearch,
    });

    const value = this.factory.parseSearchResult(
      this.context,
      response,
      payload,
    );
    return success(value);
  }

  @Reactionary({
    inputSchema: ProductSearchQueryCreateNavigationFilterSchema,
    outputSchema: FacetValueIdentifierSchema,
  })
  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>> {
    // Use the leaf (last) category in the breadcrumb path as the navigation filter.
    const leaf = payload.categoryPath.at(-1);
    const filter: FacetValueIdentifier = {
      facet: { key: 'categories' },
      key: leaf?.identifier.key ?? '',
    };
    return success(filter);
  }
}
