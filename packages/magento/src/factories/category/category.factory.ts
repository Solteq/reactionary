import {
  CategoryIdentifierSchema,
  ImageSchema,
  type AnyCategoryPaginatedResultSchema,
  type AnyCategorySchema,
  type Category,
  type CategoryFactory,
  type CategoryIdentifier,
  type CategoryPaginatedResult,
  type CategoryPaginatedResultSchema,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type CategorySchema,
  type Image,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoResolvedCategory } from '../../schema/catalog.types.js';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoCategorySearchResult } from '../../schema/magento.types.js';
import {
  buildMagentoCategoryImageUrl,
  getCategoryAttribute,
  getCategoryKey,
} from '../../utils/magento-category.js';

export interface MagentoCategoryPaginatedInput extends MagentoCategorySearchResult {
  items: MagentoResolvedCategory[];
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

  /**
   * @param config needed to turn relative category image paths into URLs;
   * without it only absolute image URLs are mapped.
   */
  constructor(
    categorySchema: TCategorySchema,
    categoryPaginatedResultSchema: TCategoryPaginatedSchema,
    protected config?: MagentoConfiguration,
  ) {
    this.categorySchema = categorySchema;
    this.categoryPaginatedResultSchema = categoryPaginatedResultSchema;
  }

  /**
   * Categories are keyed by `getCategoryKey` (external_id, falling back to the
   * entity id). The parent is taken from `parentKey`, which the capability
   * resolves to the parent's category key (null for top-level categories).
   */
  public parseCategory(
    _context: RequestContext,
    data: MagentoResolvedCategory,
  ): z.output<TCategorySchema> {
    const identifier = CategoryIdentifierSchema.parse({
      key: getCategoryKey(data),
    });

    const name = data.name || '';
    const slug = getCategoryAttribute(data, 'url_key') ?? '';
    const text = getCategoryAttribute(data, 'description') ?? '';

    const result = {
      identifier,
      name,
      slug,
      text,
      parentCategory: this.parseParentCategory(data),
      images: this.parseImages(data),
    } satisfies Category;

    return this.categorySchema.parse(result);
  }

  protected parseParentCategory(data: MagentoResolvedCategory): CategoryIdentifier | undefined {
    if (data.parentKey !== undefined) {
      return data.parentKey ? { key: data.parentKey } : undefined;
    }
    // Unresolved input: fall back to the raw parent entity id.
    const parentId = String(data.parent_id || '');
    return parentId && parentId !== '0' ? { key: parentId } : undefined;
  }

  protected parseImages(data: MagentoResolvedCategory): Image[] {
    const image = getCategoryAttribute(data, 'image');
    if (!image) {
      return [];
    }
    const isAbsolute = /^https?:\/\//i.test(image);
    if (!isAbsolute && !this.config) {
      return [];
    }
    const sourceUrl = this.config ? buildMagentoCategoryImageUrl(this.config, image) : image;
    return [ImageSchema.parse({ sourceUrl, altText: data.name || undefined })];
  }

  public parseCategoryPaginatedResult(
    context: RequestContext,
    data: MagentoCategoryPaginatedInput,
    _query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
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
