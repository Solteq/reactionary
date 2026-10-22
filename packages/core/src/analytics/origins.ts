import type {
    AssociationKind,
    CartOriginKind,
    CategoryIdentifier,
    FacetValueIdentifier,
    Origin,
    OriginAssociations,
    OriginAutocomplete,
    OriginCart,
    OriginCategory,
    OriginContent,
    OriginDirect,
    OriginList,
    OriginOrder,
    OriginPdp,
    OriginProductList,
    OriginPromotion,
    OriginQuickOrder,
    OriginSearch,
    OrderIdentifier,
    ProductIdentifier,
    ProductListIdentifier,
    ProductRecommendationIdentifier,
    PromotionIdentifier,
    QuickOrderKind,
    SearchIdentifier,
} from '../schemas/index.js';

/**
 * Constructors for {@link Origin}. `position` is always the absolute 0-based index across pages.
 */
export function fromSearch(identifier: SearchIdentifier, position: number): OriginSearch {
    return { type: 'search', identifier, position };
}

export function fromAutocomplete(term: string, position: number): OriginAutocomplete {
    return { type: 'autocomplete', term, position };
}

export function fromCategory(categoryId: CategoryIdentifier, filters: FacetValueIdentifier[], position: number): OriginCategory {
    return { type: 'category', categoryId, filters, position };
}

export function fromList(recommendationId: ProductRecommendationIdentifier | undefined, carouselName: string, position: number): OriginList {
    return { type: 'list', recommendationId, carouselName, position };
}

export function fromAssociations(productId: ProductIdentifier, kind: AssociationKind, position: number): OriginAssociations {
    return { type: 'associations', productId, kind, position };
}

export function fromProductList(listId: ProductListIdentifier, position: number): OriginProductList {
    return { type: 'product-list', listId, position };
}

export function fromPromotion(promotionId: PromotionIdentifier, slot: string): OriginPromotion {
    return { type: 'promotion', promotionId, slot };
}

export function fromContent(contentId: string, slot?: string): OriginContent {
    return { type: 'content', contentId, slot };
}

export function fromCart(kind?: CartOriginKind): OriginCart {
    return { type: 'cart', kind };
}

export function fromOrder(orderId: OrderIdentifier): OriginOrder {
    return { type: 'order', orderId };
}

export function fromQuickOrder(kind?: QuickOrderKind): OriginQuickOrder {
    return { type: 'quick-order', kind };
}

/**
 * Nests the origin of the PDP visit so conversions on the PDP stay attributed to the search or list that led there,
 * e.g. `fromPDP(fromSearch(id, 4))`. The storefront decides how to carry it between pages.
 */
export function fromPDP(upstream?: Origin): OriginPdp {
    return { type: 'pdp', upstream };
}

export function fromDirect(): OriginDirect {
    return { type: 'direct' };
}
