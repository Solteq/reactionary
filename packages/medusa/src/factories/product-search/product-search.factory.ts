import type {
  StoreProduct,
  StoreProductListResponse,
  StoreProductVariant,
} from '@medusajs/types';
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

export class MedusaProductSearchFactory<
  TProductSearchResultSchema extends
    AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(productSearchResultSchema: TProductSearchResultSchema) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    context: RequestContext,
    remote: StoreProductListResponse,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    // Parse facets
    // no facets available from Medusa at the moment

    const products: ProductSearchResultItem[] = remote.products.map((p) =>
      this.parseProductSearchResultItem(context, p),
    );

    const result = {
      identifier: {
        ...query.search,
      },
      pageNumber: (Math.ceil(remote.offset / remote.limit) || 0) + 1,
      pageSize: remote.limit,
      totalCount: remote.count,
      totalPages: Math.ceil(remote.count / remote.limit || 0) + 1,
      items: products,
      facets: [],
    } satisfies ProductSearchResult;

    (result as ProductSearchResult).facets = [];
    return this.productSearchResultSchema.parse(result);
  }

  protected parseProductSearchResultItem(
    context: RequestContext,
    data: StoreProduct,
  ): ProductSearchResultItem {
    const heroVariant = data.variants?.[0];
    const identifier = { key: data.external_id || data.id };
    const slug = data.handle;
    const name = heroVariant?.title || data.title;
    const variants = [];
    if (heroVariant) {
      variants.push(this.parseVariant(context, heroVariant, data));
    }

    const result = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return result;
  }

  protected parseVariant(
    _context: RequestContext,
    variant: StoreProductVariant,
    product: StoreProduct,
  ): ProductSearchResultItemVariant {
    const img = ImageSchema.parse({
      sourceUrl: product.images?.[0].url ?? '',
      altText: product.title || undefined,
    });

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
