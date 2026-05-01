import type {
  StoreProductCategory,
  StoreProductCategoryListResponse,
} from '@medusajs/types';
import {
  CategoryIdentifierSchema,
  type AnyCategoryPaginatedResultSchema,
  type AnyCategorySchema,
  type Category,
  type CategoryFactory,
  type CategoryPaginatedResult,
  type CategoryPaginatedResultSchema,
  type CategorySchema,
  type RequestContext,
  type CategoryQueryForTopCategories,
  type CategoryQueryForChildCategories,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaCategoryFactory<
  TCategorySchema extends AnyCategorySchema = typeof CategorySchema,
  TCategoryPaginatedSchema extends
    AnyCategoryPaginatedResultSchema = typeof CategoryPaginatedResultSchema,
> implements CategoryFactory<TCategorySchema, TCategoryPaginatedSchema>
{
  public readonly categorySchema: TCategorySchema;
  public readonly categoryPaginatedResultSchema: TCategoryPaginatedSchema;

  constructor(
    categorySchema: TCategorySchema,
    categoryPaginatedResultSchema: TCategoryPaginatedSchema,
  ) {
    this.categorySchema = categorySchema;
    this.categoryPaginatedResultSchema = categoryPaginatedResultSchema;
  }

  public parseCategory(
    _context: RequestContext,
    data: StoreProductCategory,
  ): z.output<TCategorySchema> {
    const identifier = CategoryIdentifierSchema.parse({
      key: data.external_id || '',
    });

    const name = data.name;
    const slug = data.handle;
    const text = data.description || '';
    const parentCategory = data.parent_category_id
      ? { key: data.parent_category?.external_id || '' }
      : undefined;

    const result = {
      identifier,
      name,
      slug,
      text,
      parentCategory,
      images: [],
    } satisfies Category;

    return this.categorySchema.parse(result);
  }

  public parseCategoryPaginatedResult(
    context: RequestContext,
    data: StoreProductCategoryListResponse,
    query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
  ): z.output<TCategoryPaginatedSchema> {
    const items = data.product_categories.map((x) => this.parseCategory(context, x));

    const totalPages = Math.ceil(
      (data.count ?? 0) / query.paginationOptions.pageSize,
    );
    const pageNumber = query.paginationOptions.pageNumber;
    const result = {
      pageNumber: pageNumber,
      pageSize: query.paginationOptions.pageSize,
      totalCount: data.count,
      totalPages: totalPages,
      items: items,
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
