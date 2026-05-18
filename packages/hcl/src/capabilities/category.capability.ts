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
import { getLocaleParams } from '../core/locale-params.js';

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
    const { langId } = getLocaleParams(this.config, this.context);
    const response = await this.client.findCategories({
      identifier: [payload.id.key],
      langId,
    });

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
    const { langId } = getLocaleParams(this.config, this.context);
    // Use the URL token API to resolve the slug to a category identifier.
    const token = await this.client.resolveSlug(payload.slug, langId);

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

    const response = await this.client.findCategories({
      // tokenExternalValue is the external identifier (e.g. "LivingRoom").
      // Use identifier= param so the key returned by the factory is consistent.
      identifier: [token.tokenExternalValue],
      langId,
    });

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
    const { langId } = getLocaleParams(this.config, this.context);

    // Fetch the leaf category by external identifier.
    const leafResponse = await this.client.findCategories({
      identifier: [payload.id.key],
      langId,
    });

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
        ? await this.client.findCategories({ id: ancestorIds, langId })
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
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    const { langId } = getLocaleParams(this.config, this.context);

    // Resolve the external identifier to an internal uniqueID.
    // HCL's parentCategoryId parameter requires the internal uniqueID.
    const parentResp = await this.client.findCategories({
      identifier: [payload.parentId.key],
      langId,
    });
    const parentUniqueId = parentResp.contents?.[0]?.uniqueID;

    if (!parentUniqueId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.parentId,
      });
    }

    const response = await this.client.findCategories({
      parentCategoryId: parentUniqueId,
      depthAndLimit: '1,0',
      langId,
    });

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
    const { langId } = getLocaleParams(this.config, this.context);
    // Fetching without a parentCategoryId returns root-level categories.
    const response = await this.client.findCategories({
      depthAndLimit: '1,0',
      langId,
    });

    const items = response.contents ?? [];
    const paginated = this.factory.parseCategoryPaginatedResult(
      this.context,
      items,
      payload,
    );

    return success(paginated as CategoryFactoryPaginatedOutput<TFactory>);
  }
}
