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
import type { HclCategory } from '../schema/category.schema.js';
import type { HclFindProductsQuery } from '../schema/hcl.schema.js';

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

  protected queryByTermPayload(
    payload: ProductSearchQueryByTerm,
  ): HclFindProductsQuery {
    const { term, paginationOptions, categoryFilter, facets } = payload.search;
    const { pageNumber, pageSize } = paginationOptions;
    const { langId, currency } = getLocaleParams(this.config, this.context);

    const categoryId = categoryFilter?.key || undefined;

    return {
      searchTerm: term || undefined,
      categoryId,
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      profileName: categoryId
        ? this.config.profiles.categoryBrowse
        : this.config.profiles.productSearch,
      facets: facets.length > 0 ? facets.map((f) => f.key) : undefined,
      langId,
      currency,
    };
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const response = await this.client.findProducts(
      this.queryByTermPayload(payload),
    );

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
    // The HCL product search API (categoryId param) requires the internal uniqueID.
    // HclCategoryFactory stores it as `uniqueId` — use it directly when available.
    // Fall back to a findCategories lookup when the category path came from a
    // source that did not go through HclCategoryFactory (e.g. a custom factory).
    const leaf = payload.categoryPath.at(-1) as HclCategory | undefined;
    const externalKey = leaf?.identifier.key ?? '';

    let uniqueId = leaf?.uniqueId;
    if (!uniqueId) {
      const { langId } = getLocaleParams(this.config, this.context);
      const catResp = await this.client.findCategories({
        identifier: [externalKey],
        langId,
      });
      uniqueId = catResp.contents?.[0]?.uniqueID ?? externalKey;
    }

    const filter: FacetValueIdentifier = {
      facet: { key: 'categories' },
      key: uniqueId,
    };
    return success(filter);
  }
}
