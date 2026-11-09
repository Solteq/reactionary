import type {
  ProductSearchResultAttributeFacet,
  ProductSearchResultAvailabilityFacet,
  ProductSearchResultFacet,
  ProductSearchResultPriceFacet,
  ProductSearchResultRatingFacet,
  ProductSearchResultTaxonomyFacet,
} from '@reactionary/core';

export const attributeFacets = (facets: ProductSearchResultFacet[]): ProductSearchResultAttributeFacet[] =>
  facets.flatMap((f) => (f.semantic === 'attribute' ? [f] : []));

export const attributeFacet = (facets: ProductSearchResultFacet[], key: string) =>
  attributeFacets(facets).find((f) => f.identifier.key === key);

export const taxonomyFacets = (facets: ProductSearchResultFacet[]): ProductSearchResultTaxonomyFacet[] =>
  facets.flatMap((f) => (f.semantic === 'taxonomy' ? [f] : []));

export const priceFacet = (facets: ProductSearchResultFacet[]): ProductSearchResultPriceFacet | undefined =>
  facets.flatMap((f) => (f.semantic === 'price' ? [f] : []))[0];

export const ratingFacet = (facets: ProductSearchResultFacet[]): ProductSearchResultRatingFacet | undefined =>
  facets.flatMap((f) => (f.semantic === 'rating' ? [f] : []))[0];

export const availabilityFacet = (facets: ProductSearchResultFacet[]): ProductSearchResultAvailabilityFacet | undefined =>
  facets.flatMap((f) => (f.semantic === 'availability' ? [f] : []))[0];
