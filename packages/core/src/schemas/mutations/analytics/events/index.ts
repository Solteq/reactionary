import {
    AnalyticsMutationPageViewedSchema,
    AnalyticsMutationSearchResultsViewedSchema,
    AnalyticsMutationAutocompleteSuggestionSelectedSchema,
    AnalyticsMutationCategoryViewedSchema,
    AnalyticsMutationProductCarouselViewedSchema,
    AnalyticsMutationProductClickedSchema,
    AnalyticsMutationProductViewedSchema,
    AnalyticsMutationContentViewedSchema,
    AnalyticsMutationPromotionViewedSchema,
    AnalyticsMutationPromotionClickedSchema,
} from './browse.mutation.js';
import {
    AnalyticsMutationCartItemAddedSchema,
    AnalyticsMutationCartItemRemovedSchema,
    AnalyticsMutationCartItemQuantityChangedSchema,
    AnalyticsMutationCartViewedSchema,
    AnalyticsMutationCouponAppliedSchema,
    AnalyticsMutationCouponRejectedSchema,
    AnalyticsMutationCheckoutStartedSchema,
    AnalyticsMutationShippingInfoAddedSchema,
    AnalyticsMutationPaymentInfoAddedSchema,
    AnalyticsMutationOrderPlacedSchema,
    AnalyticsMutationQuoteRequestedSchema,
    AnalyticsMutationOrderReorderedSchema,
    AnalyticsMutationCompanyRegisteredSchema,
} from './commerce.mutation.js';
import {
    AnalyticsMutationUserLoggedInSchema,
    AnalyticsMutationUserLoggedOutSchema,
    AnalyticsMutationUserRegisteredSchema,
    AnalyticsMutationProfileUpdatedSchema,
    AnalyticsMutationConsentChangedSchema,
    AnalyticsMutationNewsletterSubscribedSchema,
    AnalyticsMutationWishlistItemAddedSchema,
    AnalyticsMutationWishlistItemRemovedSchema,
    AnalyticsMutationBackInStockRequestedSchema,
    AnalyticsMutationReviewSubmittedSchema,
    AnalyticsMutationStoreSelectedSchema,
    AnalyticsMutationProductSharedSchema,
    AnalyticsMutationCustomSchema,
} from './account.mutation.js';

export * from './base.mutation.js';
export * from './browse.mutation.js';
export * from './commerce.mutation.js';
export * from './account.mutation.js';

/**
 * Maps every analytics event type to the mutation schema of its `client.analytics` helper.
 */
export const AnalyticsEventMutationSchemas = {
    'page-viewed': AnalyticsMutationPageViewedSchema,
    'search-results-viewed': AnalyticsMutationSearchResultsViewedSchema,
    'autocomplete-suggestion-selected': AnalyticsMutationAutocompleteSuggestionSelectedSchema,
    'category-viewed': AnalyticsMutationCategoryViewedSchema,
    'product-carousel-viewed': AnalyticsMutationProductCarouselViewedSchema,
    'product-clicked': AnalyticsMutationProductClickedSchema,
    'product-viewed': AnalyticsMutationProductViewedSchema,
    'content-viewed': AnalyticsMutationContentViewedSchema,
    'promotion-viewed': AnalyticsMutationPromotionViewedSchema,
    'promotion-clicked': AnalyticsMutationPromotionClickedSchema,
    'cart-item-added': AnalyticsMutationCartItemAddedSchema,
    'cart-item-removed': AnalyticsMutationCartItemRemovedSchema,
    'cart-item-quantity-changed': AnalyticsMutationCartItemQuantityChangedSchema,
    'cart-viewed': AnalyticsMutationCartViewedSchema,
    'coupon-applied': AnalyticsMutationCouponAppliedSchema,
    'coupon-rejected': AnalyticsMutationCouponRejectedSchema,
    'checkout-started': AnalyticsMutationCheckoutStartedSchema,
    'shipping-info-added': AnalyticsMutationShippingInfoAddedSchema,
    'payment-info-added': AnalyticsMutationPaymentInfoAddedSchema,
    'order-placed': AnalyticsMutationOrderPlacedSchema,
    'quote-requested': AnalyticsMutationQuoteRequestedSchema,
    'order-reordered': AnalyticsMutationOrderReorderedSchema,
    'company-registered': AnalyticsMutationCompanyRegisteredSchema,
    'user-logged-in': AnalyticsMutationUserLoggedInSchema,
    'user-logged-out': AnalyticsMutationUserLoggedOutSchema,
    'user-registered': AnalyticsMutationUserRegisteredSchema,
    'profile-updated': AnalyticsMutationProfileUpdatedSchema,
    'consent-changed': AnalyticsMutationConsentChangedSchema,
    'newsletter-subscribed': AnalyticsMutationNewsletterSubscribedSchema,
    'wishlist-item-added': AnalyticsMutationWishlistItemAddedSchema,
    'wishlist-item-removed': AnalyticsMutationWishlistItemRemovedSchema,
    'back-in-stock-requested': AnalyticsMutationBackInStockRequestedSchema,
    'review-submitted': AnalyticsMutationReviewSubmittedSchema,
    'store-selected': AnalyticsMutationStoreSelectedSchema,
    'product-shared': AnalyticsMutationProductSharedSchema,
    'custom': AnalyticsMutationCustomSchema,
} as const;

export type AnalyticsEventType = keyof typeof AnalyticsEventMutationSchemas;
