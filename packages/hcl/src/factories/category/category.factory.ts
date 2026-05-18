import type {
  AnyCategoryPaginatedResultSchema,
  AnyCategorySchema,
  Category,
  CategoryFactory,
  CategoryPaginatedResult,
  RequestContext,
  CategoryQueryForTopCategories,
  CategoryQueryForChildCategories,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclCategoryResponse } from '../../schema/hcl.schema.js';
import { type CategoryPaginatedResultSchema } from '@reactionary/core';
import type { HclCategorySchema } from '../../schema/category.schema.js';

export class HclCategoryFactory<
  TCategorySchema extends AnyCategorySchema = typeof HclCategorySchema,
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
    const identifier = { key: data.identifier };

    // Derive a slug: prefer the last path segment from the SEO href, fall back to identifier field.
    // seo.href is like "/Electronics/c/electronics" — we want "electronics".
    const slug =
      data.seo?.href?.split('/').filter(Boolean).pop() ?? data.identifier ?? '';

    // parentCatalogGroupID is a path like "/10501/10503" where the last segment is
    // this category's own uniqueID and the second-to-last is the direct parent's uniqueID.
    // The parent's external identifier is NOT in this response, so we store the
    // parent's uniqueID separately and leave `parentCategory` unset.
    const pathSegments = (
      typeof data.parentCatalogGroupID === 'string'
        ? data.parentCatalogGroupID
        : (data.parentCatalogGroupID?.[0] ?? '')
    )
      .split('/')
      .filter(Boolean);
    const parentUniqueId =
      pathSegments.length > 1
        ? pathSegments[pathSegments.length - 2]
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
    } satisfies Category;

    return this.categorySchema.parse({
      ...result,
      uniqueId: data.uniqueID,
      parentUniqueId,
    });
  }

  public parseCategoryPaginatedResult(
    context: RequestContext,
    data: HclCategoryResponse[],
    query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
  ): z.output<TCategoryPaginatedSchema> {
    const { pageNumber, pageSize } = query.paginationOptions;
    const totalCount = data.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (pageNumber - 1) * pageSize;
    const pageItems = data.slice(offset, offset + pageSize);
    const items = pageItems.map((c) => this.parseCategory(context, c));

    const result = {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      items,
    } satisfies CategoryPaginatedResult;

    return this.categoryPaginatedResultSchema.parse(result);
  }
}
