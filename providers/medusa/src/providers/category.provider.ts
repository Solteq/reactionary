import type {
  StoreProductCategory,
  StoreProductCategoryListResponse,
} from '@medusajs/types';
import type { Category, Cache, CategoryPaginatedResult } from '@reactionary/core';
import {
  CategoryIdentifierSchema,
  CategoryProvider,
  CategorySchema,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  createPaginatedResponseSchema,
  Reactionary,
  success,
  error,
  type Result,
  type NotFoundError,
  type CategoryQueryById,
  type CategoryQueryBySlug,
  type CategoryQueryForBreadcrumb,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type RequestContext,
  CategoryPaginatedResultSchema,
} from '@reactionary/core';
import type { MedusaAPI, MedusaConfiguration } from '../index.js';
import { z } from 'zod';

export class MedusaCategoryProvider extends CategoryProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI
  ) {
    super(cache, context);
    this.config = config;
  }

  protected async resolveCategoryIdByExternalId(
    externalId: string
  ): Promise<StoreProductCategory | null> {
    const sdk = await this.medusaApi.getClient();
    let offset = 0;
    const limit = 50;
    let candidate: StoreProductCategory | undefined = undefined;
    while (true) {
      try {
        const categoryResult = await sdk.store.category.list({
          offset,
          limit,
        });

        if (categoryResult.product_categories.length === 0) {
          break;
        }

        candidate = categoryResult.product_categories.find(
          (cat) => cat.metadata?.['external_id'] === externalId
        );
        if (candidate) {
          break;
        }
        offset += limit;
      } catch (error) {
        throw new Error(
          'Category not found ' + externalId + ' due to error: ' + error
        );
        break;
      }
    }
    return candidate || null;
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(payload: CategoryQueryById): Promise<Result<Category, NotFoundError>> {
    const candidate = await this.resolveCategoryIdByExternalId(payload.id.key);
    if (!candidate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      })
    }
    return success(this.parseSingle(candidate));
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug
  ): Promise<Result<Category, NotFoundError>> {
    const sdk = await this.medusaApi.getClient();

    const categoryResult = await sdk.store.category.list({
      handle: payload.slug,
      limit: 1,
      offset: 0,
    });
    if (categoryResult.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      });
    }
    return success(this.parseSingle(categoryResult.product_categories[0]));
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb
  ): Promise<Result<Category[]>> {
    const actualCategoryId = await this.resolveCategoryIdByExternalId(
      payload.id.key
    );
    if (!actualCategoryId) {
      throw new Error('Category not found ' + payload.id.key);
    }

    const sdk = await this.medusaApi.getClient();
    const path = await sdk.store.category.retrieve(actualCategoryId.id, {
      fields: '+metadata,+parent_category.metadata',
      include_ancestors_tree: true,
    });

    let results = new Array<Category>();
    let current: StoreProductCategory | null = path.product_category;
    while (current) {
      results.push(this.parseSingle(current));
      current = current.parent_category;
    }
    results = results.reverse();
    return success(results);
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories
  ) {
    const sdk = await this.medusaApi.getClient();

    const actualParentId = await this.resolveCategoryIdByExternalId(
      payload.parentId.key
    );
    if (!actualParentId) {
      throw new Error('Parent category not found ' + payload.parentId.key);
    }

    const response = await sdk.store.category.list({
      fields: '+metadata,+parent_category.metadata',
      parent_category_id: actualParentId.id,
      limit: payload.paginationOptions.pageSize,
      offset:
        (payload.paginationOptions.pageNumber - 1) *
        payload.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response);
    return success(result);
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories
  ) {
    const sdk = await this.medusaApi.getClient();

    const response = await sdk.store.category.list({
      fields: '+metadata',
      parent_category_id: 'null',
      limit: payload.paginationOptions.pageSize,
      offset:
        (payload.paginationOptions.pageNumber - 1) *
        payload.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response);

    return success(result);
  }

  protected parseSingle(_body: StoreProductCategory): Category {
    const identifier = CategoryIdentifierSchema.parse({
      key: _body.metadata?.['external_id'] || '',
    });

    const name = _body.name;
    const slug = _body.handle;
    const text = _body.description || _body.name || '';
    const parentCategory = _body.parent_category_id
      ? { key: _body.parent_category?.metadata?.['external_id'] + '' || '' }
      : undefined;

    const result = {
      identifier,
      name,
      slug,
      text,
      parentCategory,
      images: [],
    } satisfies Category;

    return result;
  }

  protected parsePaginatedResult(
    body: StoreProductCategoryListResponse
  ) {
    const items = body.product_categories.map((x) => this.parseSingle(x));

    const totalPages = Math.ceil(
      (body.count ?? 0) / Math.max(body.product_categories.length, 1)
    );
    const pageNumber =
      body.count === 0
        ? 1
        : Math.floor(body.offset / body.product_categories.length) + 1;

    const result = {
      pageNumber: pageNumber,
      pageSize: Math.max(body.product_categories.length, 1),
      totalCount: body.count,
      totalPages: totalPages,
      items: items,
    } satisfies CategoryPaginatedResult;

    return result;
  }
}
