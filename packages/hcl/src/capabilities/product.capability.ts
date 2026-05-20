import {
  ProductCapability,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type NotFoundError,
  type ProductFactory,
  type ProductFactoryOutput,
  type ProductFactoryWithOutput,
  type ProductQueryById,
  type ProductQueryBySKU,
  type ProductQueryBySlug,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclProductFactory } from '../factories/product/product.factory.js';
import type {
  HclCategoryQueryResponse,
  HclFindCategoriesQuery,
  HclFindProductsQuery,
  HclProductQueryResponse,
  HclProductResponse,
  HclUrlQueryResponse,
  HclUrlResponse,
} from '../schema/hcl.schema.js';

export class HclProductCapability<
  TFactory extends ProductFactory = HclProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getById(
    payload: ProductQueryById,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const response = await this.client.callGet<HclProductQueryResponse>(
      this.getByIdUrl(payload),
      this.getByIdPayload(payload),
    );

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data),
    );
    return success(value);
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    // Resolve the URL slug to a partNumber via the HCL URL token API.
    // tokenExternalValue holds the partNumber for ProductToken entries.
    const urlResponse = await this.client.callGet<HclUrlQueryResponse>(
      this.urlsUrl(),
      this.urlsParams(payload.slug),
      { allowUndefined: true },
    );
    const token = urlResponse?.contents?.[0];

    if (
      !token ||
      token.tokenName !== 'ProductToken' ||
      !token.tokenExternalValue
    ) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    const response = await this.client.callGet<HclProductQueryResponse>(
      this.getBySlugUrl(token),
      this.getBySlugPayload(token),
    );

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data),
    );
    return success(value);
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const response = await this.client.callGet<HclProductQueryResponse>(
      this.getBySKUUrl(payload),
      this.getBySKUPayload(payload),
    );

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.variant,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data),
    );
    return success(value);
  }

  /**
   * Resolves `parentCatalogGroupID` path strings (e.g. "/10505/10507") to external
   * category identifiers (e.g. "LivingRoomFurniture") so the factory receives
   * human-readable keys rather than internal uniqueIDs.
   */
  protected async withResolvedParentCategories(
    data: HclProductResponse,
  ): Promise<HclProductResponse> {
    const rawIds = Array.isArray(data.parentCatalogGroupID)
      ? data.parentCatalogGroupID
      : data.parentCatalogGroupID
        ? [data.parentCatalogGroupID]
        : [];

    // Each entry is a path like "/10505/10507" — the last segment is the
    // direct parent category uniqueID.
    const uniqueIds = [
      ...new Set(
        rawIds
          .map((p) => p.split('/').filter(Boolean).at(-1))
          .filter((id): id is string => id !== undefined),
      ),
    ];

    if (uniqueIds.length === 0) return data;

    const catResp = await this.client.callGet<HclCategoryQueryResponse>(
      this.categoriesUrl(),
      this.categoriesParams({ id: uniqueIds }),
    );
    const idToIdentifier = new Map(
      (catResp.contents ?? []).map((c) => [c.uniqueID, c.identifier]),
    );

    const resolvedIds = uniqueIds.map((id) => idToIdentifier.get(id) ?? id);
    return { ...data, parentCatalogGroupID: resolvedIds };
  }

  protected getByIdUrl(_payload: ProductQueryById): string {
    return this.productsUrl();
  }

  protected getBySlugUrl(_token: HclUrlResponse): string {
    return this.productsUrl();
  }

  protected getBySKUUrl(_payload: ProductQueryBySKU): string {
    return this.productsUrl();
  }

  protected getByIdPayload(payload: ProductQueryById): URLSearchParams {
    return this.productsParams({
      partNumber: [payload.identifier.key],
      profileName: this.config.profiles.product,
    });
  }

  protected getBySlugPayload(token: HclUrlResponse): URLSearchParams {
    return this.productsParams({
      partNumber: [token.tokenExternalValue!],
      profileName: this.config.profiles.product,
    });
  }

  protected getBySKUPayload(payload: ProductQueryBySKU): URLSearchParams {
    return this.productsParams({
      partNumber: [payload.variant.sku],
      profileName: this.config.profiles.product,
    });
  }

  protected productsUrl(): string {
    return `${this.client.catalogBaseUrl}/api/v2/products`;
  }

  protected productsParams(query: HclFindProductsQuery): URLSearchParams {
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
    return params;
  }

  protected categoriesUrl(): string {
    return `${this.client.catalogBaseUrl}/api/v2/categories`;
  }

  protected categoriesParams(query: HclFindCategoriesQuery): URLSearchParams {
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
    return params;
  }

  protected urlsUrl(): string {
    return `${this.client.catalogBaseUrl}/api/v2/urls`;
  }

  protected urlsParams(slug: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('identifier', slug);
    return params;
  }
}
