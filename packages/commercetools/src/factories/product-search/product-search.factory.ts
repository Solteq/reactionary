import type {
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetResult as CTProductSearchFacetResult,
  ProductSearchFacetResultBucket as CTProductSearchFacetResultBucket,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';
import type {
  ProductSearchResultSchema} from '@reactionary/core';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductOptionIdentifierSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  ProductVariantOptionSchema,
  type AnyProductSearchResultSchema,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductOptionIdentifier,
  type ProductSearchFactory,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  type ProductVariantIdentifier,
  type ProductVariantOption,
  type RequestContext,
  type SearchIdentifier,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(productSearchResultSchema: TProductSearchResultSchema) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    context: RequestContext,
    data: ProductPagedSearchResponse,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const identifier = {
      ...query.search,
    } satisfies SearchIdentifier;

    const items: ProductSearchResultItem[] = data.results.map((product) =>
      this.parseSingle(context, product.productProjection!),
    );
    const facets: ProductSearchResultFacet[] = [];

    for (const facet of data.facets) {
      const facetIdentifier = FacetIdentifierSchema.parse({
        key: facet.name,
      } satisfies Partial<FacetIdentifier>);

      const candidateFacet = this.parseFacet(facetIdentifier, facet);
      if (candidateFacet.values.length > 0) {
        facets.push(candidateFacet);
      }
    }

    const result = {
      identifier,
      pageNumber: (Math.ceil(data.offset / data.limit) || 0) + 1,
      pageSize: data.limit,
      totalCount: data.total || 0,
      totalPages: Math.ceil((data.total || 0) / data.limit || 0) + 1,
      items,
      facets,
    } satisfies ProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  protected parseSingle(
    context: RequestContext,
    data: ProductProjection,
  ): ProductSearchResultItem {
    const identifier = { key: data.id };
    const name = data.name[context.languageContext.locale] || data.id;
    const slug = data.slug?.[context.languageContext.locale] || data.id;
    const variants = [data.masterVariant, ...data.variants].map((variant) =>
      this.parseVariant(context, variant, data),
    );

    const result = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return result;
  }

  protected parseFacet(
    facetIdentifier: FacetIdentifier,
    facet: CTProductSearchFacetResult,
  ): ProductSearchResultFacet {
    const result: ProductSearchResultFacet = ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: facet.name,
      values: [],
    });

    const distinctFacet = facet as CTProductSearchFacetResultBucket;
    for (const bucket of distinctFacet.buckets || []) {
      const facetValueIdentifier = FacetValueIdentifierSchema.parse({
        facet: facetIdentifier,
        key: bucket.key,
      } satisfies Partial<FacetValueIdentifier>);

      result.values.push(
        this.parseFacetValue(facetValueIdentifier, bucket.key, bucket.count),
      );
    }

    return result;
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number,
  ): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }

  protected parseVariant(
    context: RequestContext,
    variant: CTProductVariant,
    product: ProductProjection,
  ): ProductSearchResultItemVariant {
    const sourceImage = variant.images?.[0];

    const image = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText:
        sourceImage?.label || product.name[context.languageContext.locale] || undefined,
    });

    const mappedOptions =
      variant.attributes
        ?.filter((attribute) => attribute.name === 'Color')
        .map((option) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: option.name,
            } satisfies Partial<ProductOptionIdentifier>),
            name: option.value || '',
          } satisfies Partial<ProductVariantOption>),
        ) || [];

    const mappedOption = mappedOptions?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image,
      options: mappedOption,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
