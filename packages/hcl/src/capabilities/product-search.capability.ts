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
import type { HclCategory } from '../schema/category.schema.js';
import type {
  HclCategoryQueryResponse,
  HclFindCategoriesQuery,
  HclFindProductsQuery,
  HclProductQueryResponse,
} from '../schema/hcl.schema.js';

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
    };
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const response = await this.fetchProducts(this.queryByTermPayload(payload));

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
      const catResp = await this.fetchCategories({
        identifier: [externalKey],
      });
      uniqueId = catResp.contents?.[0]?.uniqueID ?? externalKey;
    }

    const filter: FacetValueIdentifier = {
      facet: { key: 'categories' },
      key: uniqueId,
    };
    return success(filter);
  }

  protected async fetchProducts(
    query: HclFindProductsQuery,
  ): Promise<HclProductQueryResponse> {
    const params = new URLSearchParams();
    params.set('storeId', query.storeId ?? this.config.storeId);
    const catalogId = query.catalogId ?? this.config.catalogId;
    if (catalogId) params.set('catalogId', catalogId);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.searchTerm) params.set('searchTerm', query.searchTerm);
    if (query.contractId) params.set('contractId', query.contractId);
    if (query.profileName) params.set('profileName', query.profileName);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.checkEntitlement !== undefined)
      params.set('checkEntitlement', String(query.checkEntitlement));
    for (const id of query.id ?? []) params.append('id', id);
    for (const pn of query.partNumber ?? []) params.append('partNumber', pn);
    for (const facet of query.facets ?? []) params.append('facet', facet);
    return this.client.callGet<HclProductQueryResponse>(
      `${this.client.catalogBaseUrl}/api/v2/products`,
      params,
    );
  }

  protected async fetchCategories(
    query: HclFindCategoriesQuery,
  ): Promise<HclCategoryQueryResponse> {
    const params = new URLSearchParams();
    params.set('storeId', query.storeId ?? this.config.storeId);
    const catalogId = query.catalogId ?? this.config.catalogId;
    if (catalogId) params.set('catalogId', catalogId);
    if (query.parentCategoryId)
      params.set('parentCategoryId', query.parentCategoryId);
    if (query.depthAndLimit) params.set('depthAndLimit', query.depthAndLimit);
    if (query.profileName) params.set('profileName', query.profileName);
    for (const id of query.id ?? []) params.append('id', id);
    for (const identifier of query.identifier ?? [])
      params.append('identifier', identifier);
    return this.client.callGet<HclCategoryQueryResponse>(
      `${this.client.catalogBaseUrl}/api/v2/categories`,
      params,
    );
  }
}
