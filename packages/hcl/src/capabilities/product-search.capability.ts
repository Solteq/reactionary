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
import { getLocaleParams } from '../core/locale-params.js';

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
    const { term, paginationOptions, categoryFilter, facets, company } =
      payload.search;
    const { pageNumber, pageSize } = paginationOptions;
    const { langId, currency } = getLocaleParams(this.config, this.context);

    // HCL's categoryId parameter for product search requires the internal uniqueID,
    // not the external identifier. Resolve it with a category lookup when filtering.
    let categoryId: string | undefined;
    if (categoryFilter?.key) {
      const catResp = await this.client.findCategories({
        identifier: [categoryFilter.key],
        langId,
      });
      categoryId = catResp.contents?.[0]?.uniqueID;
    }

    const response = await this.client.findProducts({
      searchTerm: term || undefined,
      categoryId,
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      profileName: categoryId
        ? this.config.profiles.categoryBrowse
        : this.config.profiles.productSearch,
      facets: facets.length > 0 ? facets.map((f) => f.key) : undefined,
      contractId: company?.taxIdentifier,
      langId,
      currency,
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
