import type { StoreProductCategory, StoreProductCategoryListResponse } from '@medusajs/types';
import type { Category, Cache } from '@reactionary/core';
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
  type CategoryQueryById,
  type CategoryQueryBySlug,
  type CategoryQueryForBreadcrumb,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type RequestContext
} from '@reactionary/core';
import type { MedusaClient, MedusaConfiguration } from '../index.js';
import type z from 'zod';

export class MedusaCategoryProvider<
  T extends Category = Category
> extends CategoryProvider<T> {

  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    public client: MedusaClient
  ) {
    super(schema, cache, context);
    this.config = config;
  }

  protected async resolveCategoryIdByExternalId(externalId: string): Promise<StoreProductCategory | null> {
        const sdk = await this.client.getClient();
    let offset = 0;
    const limit = 50;
    let candidate: StoreProductCategory | undefined = undefined;
    while(true) {
      try {
        const categoryResult = await sdk.store.category.list({
          offset,
          limit
        });

        if (categoryResult.product_categories.length === 0) {
          break;
        }

        candidate = categoryResult.product_categories.find((cat) => cat.metadata?.['external_id'] === externalId);
        if (candidate) {
          break;
        }
        offset += limit;
      } catch (error) {
          throw new Error('Category not found ' +  externalId + " due to error: " + error );
        break;
      }
    }
    return candidate || null;
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(payload: CategoryQueryById): Promise<T> {
    const candidate = await this.resolveCategoryIdByExternalId(payload.id.key);
    if (!candidate) {
      const dummyCategory = this.newModel();
      dummyCategory.meta.placeholder = true;
      dummyCategory.identifier = { key: payload.id.key };
      return dummyCategory;

    }
    return this.parseSingle(candidate!);
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(payload: CategoryQueryBySlug): Promise<T | null> {
    const sdk = await this.client.getClient();

    const categoryResult = await sdk.store.category.list({
      handle: payload.slug,
      limit: 1,
      offset: 0
    });
    if (categoryResult.count === 0) {
      return null;
    }
    return this.parseSingle(categoryResult.product_categories[0]);
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
  })
  public override async getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb): Promise<T[]> {

    const actualCategoryId = await this.resolveCategoryIdByExternalId(payload.id.key);
    if (!actualCategoryId) {
      throw new Error('Category not found ' +  payload.id.key);
    }

    const sdk = await this.client.getClient();
    const path = await sdk.store.category.retrieve(actualCategoryId.id, {
      fields: '+metadata,+parent_category.metadata',
      include_ancestors_tree: true
    });

    let results: T[] = [];
    let current: StoreProductCategory | null = path.product_category;
    while(current) {
      results.push(this.parseSingle(current));
      current = current.parent_category;
    }
    results = results.reverse();
    return results;
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
  })
  public override async findChildCategories(payload: CategoryQueryForChildCategories) {
    const sdk = await this.client.getClient();

    const actualParentId = await this.resolveCategoryIdByExternalId(payload.parentId.key);
    if (!actualParentId) {
      throw new Error('Parent category not found ' +  payload.parentId.key);
    }




    const response = await sdk.store.category.list({
      fields: '+metadata,+parent_category.metadata',
      parent_category_id: actualParentId.id,
      limit: payload.paginationOptions.pageSize,
      offset: (payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response);
    result.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeyPaginatedResult(
          'top',
          result
        ),
      },
      placeholder: false,
    };
    return result;
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
  })
  public override async findTopCategories(payload: CategoryQueryForTopCategories) {
    const sdk = await this.client.getClient();


    const response = await sdk.store.category.list({
      fields: '+metadata',
      parent_category_id: "null",
      limit: payload.paginationOptions.pageSize,
      offset: (payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response);
    result.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeyPaginatedResult(
          'top',
          result
        ),
      },
      placeholder: false,
    };
    return result;
  }


  protected override parseSingle(_body: StoreProductCategory): T {

    const model = this.newModel();
    model.identifier = CategoryIdentifierSchema.parse({ key: _body.metadata?.['external_id'] || ''});
    model.name = _body.name;
    model.slug = _body.handle;
    model.text = _body.description || _body.name || '';
    model.parentCategory = _body.parent_category_id ? { key: _body.parent_category?.metadata?.['external_id'] + '' || '' } : undefined;

    return this.assert(model);
  }

  protected override parsePaginatedResult(body: StoreProductCategoryListResponse) {

    const items = body.product_categories.map((x) => this.parseSingle(x));

    const totalPages = Math.ceil((body.count ?? 0) / (Math.max(body.product_categories.length, 1)));
    const pageNumber = body.count === 0? 1:   Math.floor(body.offset / body.product_categories.length) + 1;
    const result = createPaginatedResponseSchema(this.schema).parse({
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false,
      },
      pageNumber: pageNumber,
      pageSize: Math.max(body.product_categories.length, 1),
      totalCount: body.count,

      totalPages: totalPages,
      items: items,
    });
    return result;

  }

}
