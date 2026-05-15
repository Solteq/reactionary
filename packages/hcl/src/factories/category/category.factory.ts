import type {
  AnyCategoryPaginatedResultSchema,
  AnyCategorySchema,
  Category,
  CategoryFactory,
  CategoryIdentifier,
  CategoryPaginatedResult,
  RequestContext,
  CategoryQueryForTopCategories,
  CategoryQueryForChildCategories,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclCategoryResponse } from '../../schema/hcl.schema.js';
import {
  type CategorySchema,
  type CategoryPaginatedResultSchema,
} from '@reactionary/core';

export class HclCategoryFactory<
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
    data: HclCategoryResponse,
  ): z.output<TCategorySchema> {
    const identifier = { key: data.identifier } satisfies CategoryIdentifier;

    // Derive a slug: prefer the last path segment from the SEO href, fall back to identifier field.
    // seo.href is like "/Electronics/c/electronics" — we want "electronics".
    const slug =
      data.seo?.href?.split('/').filter(Boolean).pop() ?? data.identifier ?? '';

    // parentCatalogGroupID is a path like "/10501/10503" where the last segment is
    // this category's own ID in the hierarchy. The direct parent is the second-to-last.
    const pathSegments = (
      typeof data.parentCatalogGroupID === 'string'
        ? data.parentCatalogGroupID
        : (data.parentCatalogGroupID?.[0] ?? '')
    )
      .split('/')
      .filter(Boolean);
    const parentKey =
      pathSegments.length > 1
        ? pathSegments[pathSegments.length - 2]
        : undefined;
    const parentCategory = parentKey
      ? ({ key: parentKey } satisfies CategoryIdentifier)
      : undefined;

    const images = [
      data.fullImage && {
        sourceUrl: data.fullImage,
        altText: data.name,
        width: 0,
        height: 0,
      },
      data.thumbnail &&
        data.thumbnail !== data.fullImage && {
          sourceUrl: data.thumbnail,
          altText: data.name,
          width: 0,
          height: 0,
        },
    ].filter(Boolean) as Array<{
      sourceUrl: string;
      altText: string;
      width: number;
      height: number;
    }>;

    const result = {
      identifier,
      name: data.name ?? '',
      slug,
      text: data.shortDescription ?? data.description ?? '',
      images,
      parentCategory,
    } satisfies Category;

    return this.categorySchema.parse(result);
  }

  public parseCategoryPaginatedResult(
    context: RequestContext,
    data: HclCategoryResponse[],
    query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
  ): z.output<TCategoryPaginatedSchema> {
    const items = data.map((c) => this.parseCategory(context, c));

    const result = {
      pageNumber: query.paginationOptions.pageNumber,
      pageSize: query.paginationOptions.pageSize,
      totalCount: data.length,
      totalPages: Math.ceil(data.length / query.paginationOptions.pageSize),
      items,
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
