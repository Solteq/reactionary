import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemVariantSchema,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchQueryByTerm,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
} from '@reactionary/core';
import type { SearchResponse } from 'algoliasearch';
import type {
  AlgoliaNativeRecord,
  AlgoliaNativeVariant,
  AlgoliaProductSearchResult,
} from './product-search-types.js';

function parseAlgoliaVariant(
  variant: AlgoliaNativeVariant,
  product: AlgoliaNativeRecord,
): ProductSearchResultItemVariant {
  return ProductSearchResultItemVariantSchema.parse({
    variant: {
      sku: variant.sku,
    },
    image: ImageSchema.parse({
      sourceUrl: variant.image,
      altText: product.name || '',
    }),
  } satisfies Partial<ProductSearchResultItemVariant>);
}

function parseAlgoliaSingle(body: AlgoliaNativeRecord): ProductSearchResultItem {
  return {
    identifier: { key: body.objectID },
    name: body.name || body.objectID,
    slug: body.slug || body.objectID,
    variants: [...(body.variants || [])].map((variant) => parseAlgoliaVariant(variant, body)),
  } satisfies ProductSearchResultItem;
}

function parseFacetValue(
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

function parseFacet(
  facetIdentifier: FacetIdentifier,
  facetValues: Record<string, number>,
): ProductSearchResultFacet {
  const result: ProductSearchResultFacet = ProductSearchResultFacetSchema.parse({
    identifier: facetIdentifier,
    name: facetIdentifier.key,
    values: [],
  });

  for (const facetValueKey in facetValues) {
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: facetValueKey,
    } satisfies Partial<FacetValueIdentifier>);

    result.values.push(parseFacetValue(facetValueIdentifier, facetValueKey, facetValues[facetValueKey]));
  }

  return result;
}

export function parseAlgoliaPaginatedResult(
  body: SearchResponse<AlgoliaNativeRecord>,
  query: ProductSearchQueryByTerm,
): AlgoliaProductSearchResult {
  const items = body.hits.map((hit) => parseAlgoliaSingle(hit));
  let facets: ProductSearchResultFacet[] = [];

  for (const facetKey in body.facets) {
    const facetIdentifier = FacetIdentifierSchema.parse({ key: facetKey });
    const facet = parseFacet(facetIdentifier, body.facets[facetKey]);
    facets.push(facet);
  }

  const selectedCategoryFacet =
    query.search.facets.find((x) => x.facet.key === 'categories') || query.search.categoryFilter;
  let subCategoryFacet: ProductSearchResultFacet | undefined;

  if (selectedCategoryFacet) {
    const valueDepth = selectedCategoryFacet.key.split(' > ').length;
    subCategoryFacet = facets.find((f) => f.identifier.key === `hierarchy.lvl${valueDepth}`);
  } else {
    subCategoryFacet = facets.find((f) => f.identifier.key === 'hierarchy.lvl0');
  }

  if (subCategoryFacet) {
    subCategoryFacet.identifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });
    subCategoryFacet.name = 'Categories';
    for (const value of subCategoryFacet.values) {
      const pathParts = value.identifier.key.split(' > ');
      value.identifier.facet = subCategoryFacet.identifier;
      value.name = pathParts[pathParts.length - 1];
    }
  }

  facets = facets.filter((f) => !f.identifier.key.startsWith('hierarchy.lvl'));

  return {
    identifier: {
      term: query.search.term,
      facets: query.search.facets,
      filters: query.search.filters,
      paginationOptions: query.search.paginationOptions,
      index: body.index || '',
      key: body.queryID || '',
    },
    pageNumber: (body.page || 0) + 1,
    pageSize: body.hitsPerPage || 0,
    totalCount: body.nbHits || 0,
    totalPages: body.nbPages || 0,
    items,
    facets,
  } satisfies AlgoliaProductSearchResult;
}
