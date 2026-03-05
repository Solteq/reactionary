import type { Category as CTCategory, CategoryPagedQueryResponse } from '@commercetools/platform-sdk';
import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  type AnyCategoryPaginatedResultSchema,
  type AnyCategorySchema,
  type Category,
  type CategoryFactory,
  type CategoryIdentifier,
  type CategoryPaginatedResult,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsCategoryFactory<
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
    context: RequestContext,
    data: CTCategory,
  ): z.output<TCategorySchema> {
    const identifier = { key: data.key || '' } satisfies CategoryIdentifier;
    const result = {
      identifier,
      name: data.name[context.languageContext.locale] || 'No Name',
      slug: data.slug ? data.slug[context.languageContext.locale] || '' : '',
      text: data.description ? data.description[context.languageContext.locale] || '' : '',
      parentCategory:
        data.parent && data.parent.obj && data.parent.obj?.key
          ? { key: data.parent.obj.key }
          : undefined,
      images: (data.assets || [])
        .filter((asset) => asset.sources.length > 0)
        .filter((asset) => asset.sources[0].contentType?.startsWith('image/'))
        .map((asset) => ({
          sourceUrl: asset.sources[0].uri,
          altText:
            asset.description?.[context.languageContext.locale] ||
            asset.name[context.languageContext.locale] ||
            '',
          height: asset.sources[0].dimensions?.h || 0,
          width: asset.sources[0].dimensions?.w || 0,
        })),
    } satisfies Category;

    return this.categorySchema.parse(result);
  }

  public parseCategoryPaginatedResult(
    context: RequestContext,
    data: CategoryPagedQueryResponse,
  ): z.output<TCategoryPaginatedSchema> {
    const result = {
      pageNumber: Math.floor(data.offset / data.count) + 1,
      pageSize: data.count,
      totalCount: data.total || 0,
      totalPages: Math.ceil((data.total ?? 0) / data.count),
      items: data.results.map((category) => this.parseCategory(context, category)),
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
