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
import type { HclCategoryQueryResponse } from '../schema/hcl.schema.js';
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
    // Walk up the parent chain by repeatedly resolving parentCatalogGroupID.
    // First lookup uses the external identifier (payload.id.key).
    // Subsequent lookups use the internal uniqueID extracted from parentCatalogGroupID paths.
    const path: Array<CategoryFactoryCategoryOutput<TFactory>> = [];
    const { langId } = getLocaleParams(this.config, this.context);

    let currentKey: string | undefined = payload.id.key;
    let useExternalIdentifier = true;

    while (currentKey) {
      let response: HclCategoryQueryResponse;
      if (useExternalIdentifier) {
        response = await this.client.findCategories({
          identifier: [currentKey],
          langId,
        });
      } else {
        response = await this.client.findCategories({
          id: [currentKey],
          langId,
        });
      }
      useExternalIdentifier = false;

      const data = response.contents?.[0];
      if (!data) break;

      path.unshift(this.factory.parseCategory(this.context, data));

      const parentId = data.parentCatalogGroupID;
      // parentCatalogGroupID is a path like "/10501/10503" ending with this category's own ID.
      // Extract the direct parent as the second-to-last path segment (internal uniqueID).
      const pathSegments = (
        typeof parentId === 'string' ? parentId : (parentId?.[0] ?? '')
      )
        .split('/')
        .filter(Boolean);
      const directParentId =
        pathSegments.length > 1
          ? pathSegments[pathSegments.length - 2]
          : undefined;
      if (!directParentId) break;
      currentKey = directParentId;
    }

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
