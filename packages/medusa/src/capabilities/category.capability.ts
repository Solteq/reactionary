import type {
  StoreProductCategory
} from '@medusajs/types';
import type {
  Cache,
  CategoryFactory,
  CategoryFactoryCategoryOutput,
  CategoryFactoryPaginatedOutput,
  CategoryFactoryWithOutput
} from '@reactionary/core';
import {
  CategoryCapability,
  CategoryPaginatedResultSchema,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  error,
  Reactionary,
  success,
  type CategoryQueryById,
  type CategoryQueryBySlug,
  type CategoryQueryForBreadcrumb,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type NotFoundError,
  type RequestContext,
  type Result
} from '@reactionary/core';
import * as z from 'zod';
import type { MedusaCategoryFactory } from '../factories/category/category.factory.js';
import type { MedusaAPI, MedusaConfiguration } from '../index.js';

export class MedusaCategoryCapability<
  TFactory extends CategoryFactory = MedusaCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryFactoryPaginatedOutput<TFactory>
> {
  protected config: MedusaConfiguration;
  protected factory: CategoryFactoryWithOutput<TFactory>;
  protected alwaysIncludedFields = ['+metadata', '+external_id', '+parent_category.external_id'];
  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: CategoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async resolveCategoryIdByExternalId(
    externalId: string,
  ): Promise<StoreProductCategory | null> {
    const sdk = await this.medusaApi.getClient();

    const categoryResult = await sdk.store.category.list({
      fields: this.alwaysIncludedFields.join(','),
      external_id: externalId,
      limit: 1
    });

    if (categoryResult.count === 0) {
      return null;
    }
    return categoryResult.product_categories[0];
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const candidate = await this.resolveCategoryIdByExternalId(payload.id.key);
    if (!candidate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
    return success(this.factory.parseCategory(this.context, candidate));
  }

  protected getBySlugPayload(payload: CategoryQueryBySlug) {
    return {
      handle: payload.slug,
      limit: 1,
      offset: 0,
    };
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const sdk = await this.medusaApi.getClient();

    const categoryResult = await sdk.store.category.list(
      this.getBySlugPayload(payload),
    );
    if (categoryResult.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
    return success(
      this.factory.parseCategory(
        this.context,
        categoryResult.product_categories[0],
      ),
    );
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>[]>> {
    const actualCategoryId = await this.resolveCategoryIdByExternalId(
      payload.id.key,
    );
    if (!actualCategoryId) {
      throw new Error('Category not found ' + payload.id.key);
    }

    const sdk = await this.medusaApi.getClient();
    const path = await sdk.store.category.retrieve(actualCategoryId.id, {
      fields: this.alwaysIncludedFields.join(','),
      include_ancestors_tree: true,
    });

    let results = new Array<CategoryFactoryCategoryOutput<TFactory>>();
    let current: StoreProductCategory | null = path.product_category;
    while (current) {
      results.push(this.factory.parseCategory(this.context, current));
      current = current.parent_category;
    }
    results = results.reverse();
    return success(results);
  }

  protected findChildCategoriesPayload(
    payload: CategoryQueryForChildCategories,
    actualParent: StoreProductCategory,
  ) {
    return {
      fields: this.alwaysIncludedFields.join(','),
      parent_category_id: actualParent.id,
      limit: payload.paginationOptions.pageSize,
      offset:
        (payload.paginationOptions.pageNumber - 1) *
        payload.paginationOptions.pageSize,
    };
  }
  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories,
  ) {
    const sdk = await this.medusaApi.getClient();

    const actualParent = await this.resolveCategoryIdByExternalId(
      payload.parentId.key,
    );
    if (!actualParent) {
      throw new Error('Parent category not found ' + payload.parentId.key);
    }

    const response = await sdk.store.category.list(
      this.findChildCategoriesPayload(payload, actualParent),
    );

    const result = this.factory.parseCategoryPaginatedResult(
      this.context,
      response,
      payload
    );
    return success(result);
  }

  protected findTopCategoriesPayload(payload: CategoryQueryForTopCategories) {
    return {
      fields: this.alwaysIncludedFields.join(','),
      parent_category_id: 'null',
      limit: payload.paginationOptions.pageSize,
      offset:
        (payload.paginationOptions.pageNumber - 1) *
        payload.paginationOptions.pageSize,
    };
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories,
  ) {
    const sdk = await this.medusaApi.getClient();

    const response = await sdk.store.category.list(
      this.findTopCategoriesPayload(payload),
    );

    const result = this.factory.parseCategoryPaginatedResult(
      this.context,
      response,
      payload
    );
    return success(result);
  }
}
