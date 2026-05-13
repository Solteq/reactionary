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
  type CategoryPaginatedResult,
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
    const response = await this.client.findCategories({
      id: [payload.id.key],
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
    // Use the URL token API to resolve the slug to a category uniqueID.
    const token = await this.client.resolveSlug(payload.slug);

    if (!token || token.tokenName !== 'CategoryToken' || !token.tokenExternalValue) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.slug });
    }

    const response = await this.client.findCategories({
      id: [token.tokenExternalValue],
    });

    const data = response.contents?.[0];
    if (!data) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.slug });
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
    const path: Array<CategoryFactoryCategoryOutput<TFactory>> = [];

    let currentId: string | undefined = payload.id.key;

    while (currentId) {
      const response = await this.client.findCategories({ id: [currentId] });
      const data = response.contents?.[0];
      if (!data) break;

      path.unshift(this.factory.parseCategory(this.context, data));

      const parentId = data.parentCatalogGroupID;
      // Stop when there is no valid parent (root markers: '-1', '0', or empty).
      if (!parentId || parentId === '-1' || parentId === '0' || parentId === '') {
        break;
      }
      currentId = parentId;
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
    const response = await this.client.findCategories({
      parentCategoryId: payload.parentId.key,
      depthAndLimit: '1,0',
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
    // Fetching without a parentCategoryId returns root-level categories.
    const response = await this.client.findCategories({
      depthAndLimit: '1,0',
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
