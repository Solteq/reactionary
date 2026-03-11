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
      key: data.metadata?.['external_id'] || '',
    });

    const name = data.name;
    const slug = data.handle;
    const text = data.description || data.name || '';
    const parentCategory = data.parent_category_id
      ? { key: data.parent_category?.metadata?.['external_id'] + '' || '' }
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
  ): z.output<TCategoryPaginatedSchema> {
    const items = data.product_categories.map((x) => this.parseCategory(context, x));

    const totalPages = Math.ceil(
      (data.count ?? 0) / Math.max(data.product_categories.length, 1),
    );
    const pageNumber =
      data.count === 0
        ? 1
        : Math.floor(data.offset / data.product_categories.length) + 1;

    const result = {
      pageNumber: pageNumber,
      pageSize: Math.max(data.product_categories.length, 1),
      totalCount: data.count,
      totalPages: totalPages,
      items: items,
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
