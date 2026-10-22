import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import type { AnalyticsEventType } from '../../mutations/analytics/events/index.js';
import {
    AnalyticsMutationPageViewedSchema,
    AnalyticsMutationSearchResultsViewedSchema,
    AnalyticsMutationAutocompleteSuggestionSelectedSchema,
    AnalyticsMutationCategoryViewedSchema,
    AnalyticsMutationProductCarouselViewedSchema,
    AnalyticsMutationProductClickedSchema,
    AnalyticsMutationProductViewedSchema,
    AnalyticsMutationPromotionViewedSchema,
    AnalyticsMutationPromotionClickedSchema,
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
} from '../../mutations/analytics/events/index.js';
import { AnalyticsEventEnvelopeSchema } from './envelope.model.js';

/** InferType strips index signatures, which would turn `properties` into `{}`; this keeps it readable for subscribers. */
type WithProperties<T> = T & { properties?: Record<string, unknown> };

const omitEnvelopeFields = { origin: true, properties: true } as const;

/**
 * One schema per event: the shared envelope plus the helper's mutation (minus `origin` and `properties`, which live on the envelope) as `payload`.
 */
export const AnalyticsEventPageViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('page-viewed'),
    payload: AnalyticsMutationPageViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventSearchResultsViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('search-results-viewed'),
    payload: AnalyticsMutationSearchResultsViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventAutocompleteSuggestionSelectedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('autocomplete-suggestion-selected'),
    payload: AnalyticsMutationAutocompleteSuggestionSelectedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCategoryViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('category-viewed'),
    payload: AnalyticsMutationCategoryViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventProductCarouselViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('product-carousel-viewed'),
    payload: AnalyticsMutationProductCarouselViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventProductClickedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('product-clicked'),
    payload: AnalyticsMutationProductClickedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventProductViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('product-viewed'),
    payload: AnalyticsMutationProductViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventPromotionViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('promotion-viewed'),
    payload: AnalyticsMutationPromotionViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventPromotionClickedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('promotion-clicked'),
    payload: AnalyticsMutationPromotionClickedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCartItemAddedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('cart-item-added'),
    payload: AnalyticsMutationCartItemAddedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCartItemRemovedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('cart-item-removed'),
    payload: AnalyticsMutationCartItemRemovedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCartItemQuantityChangedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('cart-item-quantity-changed'),
    payload: AnalyticsMutationCartItemQuantityChangedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCartViewedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('cart-viewed'),
    payload: AnalyticsMutationCartViewedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCouponAppliedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('coupon-applied'),
    payload: AnalyticsMutationCouponAppliedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCouponRejectedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('coupon-rejected'),
    payload: AnalyticsMutationCouponRejectedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCheckoutStartedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('checkout-started'),
    payload: AnalyticsMutationCheckoutStartedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventShippingInfoAddedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('shipping-info-added'),
    payload: AnalyticsMutationShippingInfoAddedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventPaymentInfoAddedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('payment-info-added'),
    payload: AnalyticsMutationPaymentInfoAddedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventOrderPlacedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('order-placed'),
    payload: AnalyticsMutationOrderPlacedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventQuoteRequestedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('quote-requested'),
    payload: AnalyticsMutationQuoteRequestedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventOrderReorderedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('order-reordered'),
    payload: AnalyticsMutationOrderReorderedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCompanyRegisteredSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('company-registered'),
    payload: AnalyticsMutationCompanyRegisteredSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventUserLoggedInSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('user-logged-in'),
    payload: AnalyticsMutationUserLoggedInSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventUserLoggedOutSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('user-logged-out'),
    payload: AnalyticsMutationUserLoggedOutSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventUserRegisteredSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('user-registered'),
    payload: AnalyticsMutationUserRegisteredSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventProfileUpdatedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('profile-updated'),
    payload: AnalyticsMutationProfileUpdatedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventConsentChangedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('consent-changed'),
    payload: AnalyticsMutationConsentChangedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventNewsletterSubscribedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('newsletter-subscribed'),
    payload: AnalyticsMutationNewsletterSubscribedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventWishlistItemAddedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('wishlist-item-added'),
    payload: AnalyticsMutationWishlistItemAddedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventWishlistItemRemovedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('wishlist-item-removed'),
    payload: AnalyticsMutationWishlistItemRemovedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventBackInStockRequestedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('back-in-stock-requested'),
    payload: AnalyticsMutationBackInStockRequestedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventReviewSubmittedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('review-submitted'),
    payload: AnalyticsMutationReviewSubmittedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventStoreSelectedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('store-selected'),
    payload: AnalyticsMutationStoreSelectedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventProductSharedSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('product-shared'),
    payload: AnalyticsMutationProductSharedSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventCustomSchema = AnalyticsEventEnvelopeSchema.extend({
    type: z.literal('custom'),
    payload: AnalyticsMutationCustomSchema.omit(omitEnvelopeFields),
});

export const AnalyticsEventSchema = z.discriminatedUnion('type', [
    AnalyticsEventPageViewedSchema,
    AnalyticsEventSearchResultsViewedSchema,
    AnalyticsEventAutocompleteSuggestionSelectedSchema,
    AnalyticsEventCategoryViewedSchema,
    AnalyticsEventProductCarouselViewedSchema,
    AnalyticsEventProductClickedSchema,
    AnalyticsEventProductViewedSchema,
    AnalyticsEventPromotionViewedSchema,
    AnalyticsEventPromotionClickedSchema,
    AnalyticsEventCartItemAddedSchema,
    AnalyticsEventCartItemRemovedSchema,
    AnalyticsEventCartItemQuantityChangedSchema,
    AnalyticsEventCartViewedSchema,
    AnalyticsEventCouponAppliedSchema,
    AnalyticsEventCouponRejectedSchema,
    AnalyticsEventCheckoutStartedSchema,
    AnalyticsEventShippingInfoAddedSchema,
    AnalyticsEventPaymentInfoAddedSchema,
    AnalyticsEventOrderPlacedSchema,
    AnalyticsEventQuoteRequestedSchema,
    AnalyticsEventOrderReorderedSchema,
    AnalyticsEventCompanyRegisteredSchema,
    AnalyticsEventUserLoggedInSchema,
    AnalyticsEventUserLoggedOutSchema,
    AnalyticsEventUserRegisteredSchema,
    AnalyticsEventProfileUpdatedSchema,
    AnalyticsEventConsentChangedSchema,
    AnalyticsEventNewsletterSubscribedSchema,
    AnalyticsEventWishlistItemAddedSchema,
    AnalyticsEventWishlistItemRemovedSchema,
    AnalyticsEventBackInStockRequestedSchema,
    AnalyticsEventReviewSubmittedSchema,
    AnalyticsEventStoreSelectedSchema,
    AnalyticsEventProductSharedSchema,
    AnalyticsEventCustomSchema,
]);

export type AnalyticsEventPageViewed = WithProperties<InferType<typeof AnalyticsEventPageViewedSchema>>;
export type AnalyticsEventSearchResultsViewed = WithProperties<InferType<typeof AnalyticsEventSearchResultsViewedSchema>>;
export type AnalyticsEventAutocompleteSuggestionSelected = WithProperties<InferType<typeof AnalyticsEventAutocompleteSuggestionSelectedSchema>>;
export type AnalyticsEventCategoryViewed = WithProperties<InferType<typeof AnalyticsEventCategoryViewedSchema>>;
export type AnalyticsEventProductCarouselViewed = WithProperties<InferType<typeof AnalyticsEventProductCarouselViewedSchema>>;
export type AnalyticsEventProductClicked = WithProperties<InferType<typeof AnalyticsEventProductClickedSchema>>;
export type AnalyticsEventProductViewed = WithProperties<InferType<typeof AnalyticsEventProductViewedSchema>>;
export type AnalyticsEventPromotionViewed = WithProperties<InferType<typeof AnalyticsEventPromotionViewedSchema>>;
export type AnalyticsEventPromotionClicked = WithProperties<InferType<typeof AnalyticsEventPromotionClickedSchema>>;
export type AnalyticsEventCartItemAdded = WithProperties<InferType<typeof AnalyticsEventCartItemAddedSchema>>;
export type AnalyticsEventCartItemRemoved = WithProperties<InferType<typeof AnalyticsEventCartItemRemovedSchema>>;
export type AnalyticsEventCartItemQuantityChanged = WithProperties<InferType<typeof AnalyticsEventCartItemQuantityChangedSchema>>;
export type AnalyticsEventCartViewed = WithProperties<InferType<typeof AnalyticsEventCartViewedSchema>>;
export type AnalyticsEventCouponApplied = WithProperties<InferType<typeof AnalyticsEventCouponAppliedSchema>>;
export type AnalyticsEventCouponRejected = WithProperties<InferType<typeof AnalyticsEventCouponRejectedSchema>>;
export type AnalyticsEventCheckoutStarted = WithProperties<InferType<typeof AnalyticsEventCheckoutStartedSchema>>;
export type AnalyticsEventShippingInfoAdded = WithProperties<InferType<typeof AnalyticsEventShippingInfoAddedSchema>>;
export type AnalyticsEventPaymentInfoAdded = WithProperties<InferType<typeof AnalyticsEventPaymentInfoAddedSchema>>;
export type AnalyticsEventOrderPlaced = WithProperties<InferType<typeof AnalyticsEventOrderPlacedSchema>>;
export type AnalyticsEventQuoteRequested = WithProperties<InferType<typeof AnalyticsEventQuoteRequestedSchema>>;
export type AnalyticsEventOrderReordered = WithProperties<InferType<typeof AnalyticsEventOrderReorderedSchema>>;
export type AnalyticsEventCompanyRegistered = WithProperties<InferType<typeof AnalyticsEventCompanyRegisteredSchema>>;
export type AnalyticsEventUserLoggedIn = WithProperties<InferType<typeof AnalyticsEventUserLoggedInSchema>>;
export type AnalyticsEventUserLoggedOut = WithProperties<InferType<typeof AnalyticsEventUserLoggedOutSchema>>;
export type AnalyticsEventUserRegistered = WithProperties<InferType<typeof AnalyticsEventUserRegisteredSchema>>;
export type AnalyticsEventProfileUpdated = WithProperties<InferType<typeof AnalyticsEventProfileUpdatedSchema>>;
export type AnalyticsEventConsentChanged = WithProperties<InferType<typeof AnalyticsEventConsentChangedSchema>>;
export type AnalyticsEventNewsletterSubscribed = WithProperties<InferType<typeof AnalyticsEventNewsletterSubscribedSchema>>;
export type AnalyticsEventWishlistItemAdded = WithProperties<InferType<typeof AnalyticsEventWishlistItemAddedSchema>>;
export type AnalyticsEventWishlistItemRemoved = WithProperties<InferType<typeof AnalyticsEventWishlistItemRemovedSchema>>;
export type AnalyticsEventBackInStockRequested = WithProperties<InferType<typeof AnalyticsEventBackInStockRequestedSchema>>;
export type AnalyticsEventReviewSubmitted = WithProperties<InferType<typeof AnalyticsEventReviewSubmittedSchema>>;
export type AnalyticsEventStoreSelected = WithProperties<InferType<typeof AnalyticsEventStoreSelectedSchema>>;
export type AnalyticsEventProductShared = WithProperties<InferType<typeof AnalyticsEventProductSharedSchema>>;
export type AnalyticsEventCustom = WithProperties<InferType<typeof AnalyticsEventCustomSchema>>;

export type AnalyticsEventUnion = WithProperties<InferType<typeof AnalyticsEventSchema>>;
/** An event of type `K`, or any event. */
export type AnalyticsEvent<K extends AnalyticsEventType = AnalyticsEventType> = Extract<AnalyticsEventUnion, { type: K }>;
export type AnalyticsEventPayload<K extends AnalyticsEventType = AnalyticsEventType> = AnalyticsEvent<K>['payload'];
