import type { ProductSearchQueryByTerm, ProductSearchResultFacet } from '@reactionary/core';

type SelectedSearch = Pick<
  ProductSearchQueryByTerm['search'],
  'facets' | 'conceptFilter' | 'priceFilter' | 'ratingFilter' | 'availabilityFilter'
>;

/**
 * Marks what the search has selected as active on its facets, and the price range on the price facet. The facets of the requests that
 * offer what a selection hides come from searches without that selection, so the marking is done on the merged result.
 */
export function markSelectedFacets(facets: ProductSearchResultFacet[], search: SelectedSearch): void {
  const concepts = new Set((search.conceptFilter ?? []).map((concept) => concept.key));
  const stores = new Set((search.availabilityFilter?.stores ?? []).map((store) => store.key));
  const rating = search.ratingFilter;
  const price = search.priceFilter;
  const priceRestricts = price !== undefined && (price.min !== undefined || price.max !== undefined);

  for (const facet of facets) {
    switch (facet.semantic) {
      case 'attribute':
        for (const selected of search.facets) {
          if (selected.facet.key !== facet.identifier.key) {
            continue;
          }
          const value = facet.values.find((v) => v.identifier.key === selected.key);
          if (value) {
            value.active = true;
          }
        }
        break;
      case 'taxonomy':
        for (const value of facet.values) {
          value.active = concepts.has(value.concept.key);
        }
        break;
      case 'rating':
        for (const bucket of facet.buckets) {
          bucket.active =
            rating !== undefined &&
            (rating.min !== undefined || rating.max !== undefined) &&
            bucket.min >= (rating.min ?? Number.NEGATIVE_INFINITY) &&
            bucket.max <= (rating.max ?? Number.POSITIVE_INFINITY);
        }
        break;
      case 'availability':
        if (facet.online) {
          facet.online.active = search.availabilityFilter?.online === true;
        }
        for (const store of facet.stores) {
          store.active = stores.has(store.store.key);
        }
        break;
      case 'price':
        if (priceRestricts) {
          facet.selected = {
            ...(price.min !== undefined ? { min: price.min } : {}),
            ...(price.max !== undefined ? { max: price.max } : {}),
          };
        }
        break;
    }
  }
}
