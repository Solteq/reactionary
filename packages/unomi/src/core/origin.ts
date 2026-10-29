import type { Origin } from '@reactionary/core';
import type { OriginProperties } from '../contract/index.js';

/** The facet values of a listing as `facet:value`, the shape the contract uses. */
function filters(values: ReadonlyArray<{ facet: { key: string }; key: string }>): string[] | undefined {
  const flat = values.map((v) => `${v.facet.key}:${v.key}`);
  return flat.length > 0 ? flat : undefined;
}

/**
 * Reactionary's origin as the flat origin of the contract. Position is left out: it says nothing about intent. A visit to a
 * product page keeps the origin that led there, so what the visitor did stays attributed to the search or list.
 */
export function flattenOrigin(origin: Origin): OriginProperties {
  switch (origin.type) {
    case 'search':
      return { type: 'search', term: origin.identifier.term, filters: filters(origin.identifier.facets) };
    case 'autocomplete':
      return { type: 'autocomplete', term: origin.term };
    case 'category':
      return { type: 'category', categoryId: origin.categoryId.key, filters: filters(origin.filters) };
    case 'list':
      return { type: 'list', carouselName: origin.carouselName };
    case 'associations':
      return { type: 'associations', productId: origin.productId.key };
    case 'product-list':
      return { type: 'product-list', listId: origin.listId.key };
    case 'promotion':
      return { type: 'promotion', promotionId: origin.promotionId.key, slot: origin.slot };
    case 'content':
      return { type: 'content', contentId: origin.contentId, slot: origin.slot };
    case 'cart':
    case 'order':
    case 'quick-order':
    case 'direct':
      return { type: origin.type };
    case 'pdp':
      return origin.upstream ? flattenOrigin(origin.upstream) : { type: 'pdp' };
  }
}

/** A coarse device class from a user agent, or nothing when there is none. */
export function deviceClass(userAgent: string | undefined): 'mobile' | 'tablet' | 'desktop' | undefined {
  if (!userAgent) {
    return undefined;
  }
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(userAgent)) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
}
