import type {
  FacetIdentifier,
  FacetValueIdentifier,
  ProductOptionIdentifier,
  ProductSearchQueryByTerm,
  ProductSearchResult,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductVariantIdentifier,
  ProductVariantOption,
  SearchIdentifier,
} from '@reactionary/core';
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
} from '@reactionary/core';
import type {
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetResult as CTProductSearchFacetResult,
  ProductSearchFacetResultBucket as CTProductSearchFacetResultBucket,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';

function parseCommercetoolsProductSearchVariant(
  variant: CTProductVariant,
  product: ProductProjection,
  locale: string,
): ProductSearchResultItemVariant {
  const sourceImage = variant.images?.[0];

  const image = ImageSchema.parse({
    sourceUrl: sourceImage?.url || '',
    height: sourceImage?.dimensions.h || undefined,
    width: sourceImage?.dimensions.w || undefined,
    altText: sourceImage?.label || product.name[locale] || undefined,
  });

  const mappedOptions =
    variant.attributes
      ?.filter((x) => x.name === 'Color')
      .map((opt) =>
        ProductVariantOptionSchema.parse({
          identifier: ProductOptionIdentifierSchema.parse({
            key: opt.name,
          } satisfies Partial<ProductOptionIdentifier>),
          name: `${opt.value || ''}`,
        } satisfies Partial<ProductVariantOption>),
      ) || [];

  return ProductSearchResultItemVariantSchema.parse({
    variant: ProductVariantIdentifierSchema.parse({
      sku: variant.sku || '',
    } satisfies ProductVariantIdentifier),
    image,
    options: mappedOptions[0],
  } satisfies Partial<ProductSearchResultItemVariant>);
}

function parseCommercetoolsProductSearchSingle(body: ProductProjection, locale: string): ProductSearchResultItem {
  const variants = [body.masterVariant, ...body.variants].map((variant) =>
    parseCommercetoolsProductSearchVariant(variant, body, locale),
  );

  return {
    identifier: { key: body.id },
    name: body.name[locale] || body.id,
    slug: body.slug?.[locale] || body.id,
    variants,
  } satisfies ProductSearchResultItem;
}

function parseCommercetoolsProductSearchFacetValue(
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

function parseCommercetoolsProductSearchFacet(
  facetIdentifier: FacetIdentifier,
  facet: CTProductSearchFacetResult,
): ProductSearchResultFacet {
  const result = ProductSearchResultFacetSchema.parse({
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
      parseCommercetoolsProductSearchFacetValue(facetValueIdentifier, bucket.key, bucket.count),
    );
  }

  return result;
}

export function parseCommercetoolsProductSearchResult(
  body: ProductPagedSearchResponse,
  query: ProductSearchQueryByTerm,
  locale: string,
): ProductSearchResult {
  const identifier = {
    ...query.search,
  } satisfies SearchIdentifier;

  const items: ProductSearchResultItem[] = body.results
    .map((entry) => entry.productProjection)
    .filter((entry): entry is ProductProjection => !!entry)
    .map((entry) => parseCommercetoolsProductSearchSingle(entry, locale));

  const facets: ProductSearchResultFacet[] = [];
  for (const facet of body.facets) {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: facet.name,
    } satisfies Partial<FacetIdentifier>);

    const candidate = parseCommercetoolsProductSearchFacet(facetIdentifier, facet);
    if (candidate.values.length > 0) {
      facets.push(candidate);
    }
  }

  return {
    identifier,
    pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
    pageSize: body.limit,
    totalCount: body.total || 0,
    totalPages: Math.ceil((body.total || 0) / body.limit || 0) + 1,
    items,
    facets,
  } satisfies ProductSearchResult;
}
