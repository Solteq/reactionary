import {
  CategoryCapability,
  CategoryPaginatedResultSchema,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  Reactionary,
  error,
  success,
  type Cache,
  type CategoryFactory,
  type CategoryFactoryCategoryOutput,
  type CategoryFactoryPaginatedOutput,
  type CategoryFactoryWithOutput,
  type CategoryQueryById,
  type CategoryQueryBySlug,
  type CategoryQueryForBreadcrumb,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type NotFoundError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import * as z from 'zod';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclCategoryFactory } from '../factories/category/category.factory.js';
import type {
  HclCategoryQueryResponse,
  HclFindCategoriesQuery,
  HclUrlQueryResponse,
  HclUrlResponse,
} from '../schema/hcl.schema.js';

export class HclCategoryCapability<
  TFactory extends CategoryFactory = HclCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryFactoryPaginatedOutput<TFactory>
> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: CategoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const response = await this.client.callGet<HclCategoryQueryResponse>(
      this.getByIdUrl(payload),
      this.getByIdPayload(payload),
    );

    const data = response.contents?.[0];
    if (!data) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.id });
    }

    return success(this.factory.parseCategory(this.context, data));
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema,
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    // Use the URL token API to resolve the slug to a category uniqueID.
    const urlResponse = await this.client.callGet<HclUrlQueryResponse>(
      this.urlsUrl(),
      this.urlsParams(payload.slug),
      { allowUndefined: true },
    );
    const token = urlResponse?.contents?.[0];

    if (
      !token ||
      token.tokenName !== 'CategoryToken' ||
      !token.tokenExternalValue
    ) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    const response = await this.client.callGet<HclCategoryQueryResponse>(
      this.getBySlugUrl(token),
      this.getBySlugPayload(token),
    );

    const data = response.contents?.[0];
    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    return success(this.factory.parseCategory(this.context, data));
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb,
  ): Promise<Result<Array<CategoryFactoryCategoryOutput<TFactory>>>> {
    // Fetch the leaf category by external identifier.
    const leafResponse = await this.client.callGet<HclCategoryQueryResponse>(
      this.getBreadcrumbLeafUrl(payload),
      this.getBreadcrumbLeafPayload(payload),
    );

    const leafData = leafResponse.contents?.[0];
    if (!leafData) {
      return success([]);
    }

    // parentCatalogGroupID is a path like "/10501/10503/10504" where the last segment
    // is this category's own uniqueID and all earlier segments are ancestor uniqueIDs
    // in root-first order. Extract them to fetch all ancestors in parallel.
    const parentId = leafData.parentCatalogGroupID;
    const pathSegments = (
      typeof parentId === 'string' ? parentId : (parentId?.[0] ?? '')
    )
      .split('/')
      .filter(Boolean);
    // All segments except the last are ancestor uniqueIDs (root-first order).
    const ancestorIds = pathSegments.slice(0, -1);

    // Fetch all ancestors in a single request — the id param accepts multiple values.
    const ancestorsResp =
      ancestorIds.length > 0
        ? await this.client.callGet<HclCategoryQueryResponse>(
            this.getBreadcrumbAncestorsUrl(ancestorIds),
            this.getBreadcrumbAncestorsPayload(ancestorIds),
          )
        : { contents: [] };

    // Re-order results to match the original root-first order from pathSegments,
    // since the API does not guarantee response ordering when multiple ids are passed.
    const byUniqueId = new Map(
      (ancestorsResp.contents ?? []).map((c) => [c.uniqueID, c]),
    );

    // Build the breadcrumb: ancestors in root-first order, leaf at the end.
    const path: Array<CategoryFactoryCategoryOutput<TFactory>> = [];
    for (const id of ancestorIds) {
      const data = byUniqueId.get(id);
      if (data) {
        path.push(this.factory.parseCategory(this.context, data));
      }
    }
    path.push(this.factory.parseCategory(this.context, leafData));

    return success(path);
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>, NotFoundError>> {
    // Resolve the external identifier to an internal uniqueID.
    // HCL's parentCategoryId parameter requires the internal uniqueID.
    const parentResp = await this.client.callGet<HclCategoryQueryResponse>(
      this.findChildCategoriesParentUrl(payload),
      this.findChildCategoriesParentPayload(payload),
    );
    const parentUniqueId = parentResp.contents?.[0]?.uniqueID;

    if (!parentUniqueId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.parentId,
      });
    }

    const response = await this.client.callGet<HclCategoryQueryResponse>(
      this.findChildCategoriesUrl(parentUniqueId),
      this.findChildCategoriesPayload(parentUniqueId),
    );

    const items = response.contents ?? [];
    const paginated = this.factory.parseCategoryPaginatedResult(
      this.context,
      items,
      payload,
    );

    return success(paginated as CategoryFactoryPaginatedOutput<TFactory>);
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    // Fetching without a parentCategoryId returns root-level categories.
    const response = await this.client.callGet<HclCategoryQueryResponse>(
      this.findTopCategoriesUrl(payload),
      this.findTopCategoriesPayload(),
    );

    const items = response.contents ?? [];
    const paginated = this.factory.parseCategoryPaginatedResult(
      this.context,
      items,
      payload,
    );

    return success(paginated as CategoryFactoryPaginatedOutput<TFactory>);
  }

  protected getByIdUrl(_payload: CategoryQueryById): string {
    return this.categoriesUrl();
  }

  protected getBySlugUrl(_token: HclUrlResponse): string {
    return this.categoriesUrl();
  }

  protected getBreadcrumbLeafUrl(_payload: CategoryQueryForBreadcrumb): string {
    return this.categoriesUrl();
  }

  protected getBreadcrumbAncestorsUrl(_ancestorIds: string[]): string {
    return this.categoriesUrl();
  }

  protected findChildCategoriesParentUrl(
    _payload: CategoryQueryForChildCategories,
  ): string {
    return this.categoriesUrl();
  }

  protected findChildCategoriesUrl(_parentUniqueId: string): string {
    return this.categoriesUrl();
  }

  protected findTopCategoriesUrl(
    _payload: CategoryQueryForTopCategories,
  ): string {
    return this.categoriesUrl();
  }

  protected getByIdPayload(payload: CategoryQueryById): URLSearchParams {
    return this.categoriesParams({ identifier: [payload.id.key] });
  }

  // tokenValue is the numeric uniqueID; tokenExternalValue is the string identifier
  // which the categories API rejects with 400 when used as an id= parameter.
  protected getBySlugPayload(token: HclUrlResponse): URLSearchParams {
    return this.categoriesParams({ id: [token.tokenValue] });
  }

  protected getBreadcrumbLeafPayload(
    payload: CategoryQueryForBreadcrumb,
  ): URLSearchParams {
    return this.categoriesParams({ identifier: [payload.id.key] });
  }

  protected getBreadcrumbAncestorsPayload(
    ancestorIds: string[],
  ): URLSearchParams {
    return this.categoriesParams({ id: ancestorIds });
  }

  protected findChildCategoriesParentPayload(
    payload: CategoryQueryForChildCategories,
  ): URLSearchParams {
    return this.categoriesParams({ identifier: [payload.parentId.key] });
  }

  protected findChildCategoriesPayload(
    parentUniqueId: string,
  ): URLSearchParams {
    return this.categoriesParams({
      parentCategoryId: parentUniqueId,
      depthAndLimit: '0',
    });
  }

  protected findTopCategoriesPayload(): URLSearchParams {
    return this.categoriesParams({ depthAndLimit: '0' });
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
