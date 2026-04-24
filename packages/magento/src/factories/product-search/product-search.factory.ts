import {
  ImageSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  type AnyProductSearchResultSchema,
  type ProductSearchFactory,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  type ProductSearchResultSchema,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoProduct, MagentoProductSearchResult } from '../../schema/magento.types.js';

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
  if (!product.custom_attributes) return undefined;
  const found = product.custom_attributes.find((a) => a.attribute_code === code);
  if (found?.value === null || found?.value === undefined) return undefined;
  return String(found.value);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildMagentoImageUrl(config: MagentoConfiguration, file: string): string {
  const mediaUrl = (config as Record<string, unknown>)['mediaUrl'] as string | undefined;
  if (mediaUrl) {
    return `${mediaUrl.replace(/\/+$/, '')}${file.startsWith('/') ? '' : '/'}${file}`;
  }

  const storeBase = normalizeBaseUrl(config.baseUrl);
  return `${storeBase}/media/catalog/product${file.startsWith('/') ? '' : '/'}${file}`;
}

export class MagentoProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(
    productSearchResultSchema: TProductSearchResultSchema,
    protected config: MagentoConfiguration,
  ) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    context: RequestContext,
    data: MagentoProductSearchResult,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const pageSize = query.search.paginationOptions.pageSize;
    const currentPage = query.search.paginationOptions.pageNumber;

    const items: ProductSearchResultItem[] = (data.items || []).map((p) =>
      this.parseProductSearchResultItem(context, p),
    );

    const totalCount = data.total_count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const result = {
      identifier: {
        ...query.search,
      },
      pageNumber: currentPage,
      pageSize,
      totalCount,
      totalPages,
      items,
      facets: [],
    } satisfies ProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  protected parseProductSearchResultItem(
    _context: RequestContext,
    product: MagentoProduct,
  ): ProductSearchResultItem {
    const idKey = product.id !== undefined ? String(product.id) : product.sku;
    const identifier = { key: idKey };
    const slug =
      getCustomAttribute(product, 'url_key') ??
      getCustomAttribute(product, 'url_path') ??
      '';
    const name = product.name || product.sku;

    const variants: ProductSearchResultItemVariant[] = [];
    if (product.sku) {
      variants.push(this.parseVariant(product, product));
    }

    return {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;
  }

  protected parseVariant(
    variant: MagentoProduct,
    product: MagentoProduct,
  ): ProductSearchResultItemVariant {
    const media = product.media_gallery_entries;
    const firstImage = media && media.length > 0 ? media[0].file : null;

    const img = firstImage
      ? ImageSchema.parse({
        sourceUrl: buildMagentoImageUrl(this.config, firstImage),
        altText: product.name || undefined,
      })
      : ImageSchema.parse({
        sourceUrl: '',
        altText: product.name || undefined,
      });

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku,
      } satisfies ProductVariantIdentifier),
      image: img,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
