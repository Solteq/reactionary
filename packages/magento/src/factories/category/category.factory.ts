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
import type { MagentoCategory, MagentoCategorySearchResult } from '../../schema/magento.types.js';

export interface MagentoCategoryPaginatedInput extends MagentoCategorySearchResult {
  pageSize: number;
  currentPage: number;
}

export class MagentoCategoryFactory<
  TCategorySchema extends AnyCategorySchema = typeof CategorySchema,
  TCategoryPaginatedSchema extends AnyCategoryPaginatedResultSchema = typeof CategoryPaginatedResultSchema,
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
    data: MagentoCategory,
  ): z.output<TCategorySchema> {
    const identifier = CategoryIdentifierSchema.parse({
      key: String(data.custom_attributes?.find((a) => a.attribute_code === 'external_id')?.value || data.id),
    });

    const name = data.name || '';

    const urlKeyAttr = data.custom_attributes?.find((a) => a.attribute_code === 'url_key');
    const slug = urlKeyAttr ? String(urlKeyAttr.value) : '';

    const textAttr = data.custom_attributes?.find((a) => a.attribute_code === 'description');
    const text = textAttr ? String(textAttr.value) : name;

    const parentCategoryStr = String(data.parent_id || '');
    const parentCategory = parentCategoryStr && parentCategoryStr !== '0'
      ? { key: parentCategoryStr }
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
    data: MagentoCategoryPaginatedInput,
  ): z.output<TCategoryPaginatedSchema> {
    const items = (data.items || []).map((c) => this.parseCategory(context, c));

    const totalCount = data.total_count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / data.pageSize));

    const result = {
      pageNumber: data.currentPage,
      pageSize: data.pageSize,
      totalCount,
      totalPages,
      items,
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
