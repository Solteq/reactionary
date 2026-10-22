import type { AnalyticsDispatcher } from '../analytics/dispatcher.js';
import type { Cache } from '../cache/cache.interface.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';
import {
  AnalyticsEventResultSchema,
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
  type AnalyticsEventResult,
  type AnalyticsMutationPageViewed,
  type AnalyticsMutationSearchResultsViewed,
  type AnalyticsMutationAutocompleteSuggestionSelected,
  type AnalyticsMutationCategoryViewed,
  type AnalyticsMutationProductCarouselViewed,
  type AnalyticsMutationProductClicked,
  type AnalyticsMutationProductViewed,
  type AnalyticsMutationPromotionViewed,
  type AnalyticsMutationPromotionClicked,
  type AnalyticsMutationCartItemAdded,
  type AnalyticsMutationCartItemRemoved,
  type AnalyticsMutationCartItemQuantityChanged,
  type AnalyticsMutationCartViewed,
  type AnalyticsMutationCouponApplied,
  type AnalyticsMutationCouponRejected,
  type AnalyticsMutationCheckoutStarted,
  type AnalyticsMutationShippingInfoAdded,
  type AnalyticsMutationPaymentInfoAdded,
  type AnalyticsMutationOrderPlaced,
  type AnalyticsMutationQuoteRequested,
  type AnalyticsMutationOrderReordered,
  type AnalyticsMutationCompanyRegistered,
  type AnalyticsMutationUserLoggedIn,
  type AnalyticsMutationUserLoggedOut,
  type AnalyticsMutationUserRegistered,
  type AnalyticsMutationProfileUpdated,
  type AnalyticsMutationConsentChanged,
  type AnalyticsMutationNewsletterSubscribed,
  type AnalyticsMutationWishlistItemAdded,
  type AnalyticsMutationWishlistItemRemoved,
  type AnalyticsMutationBackInStockRequested,
  type AnalyticsMutationReviewSubmitted,
  type AnalyticsMutationStoreSelected,
  type AnalyticsMutationProductShared,
  type AnalyticsMutationCustom,
  type RequestContext,
  type Result,
} from '../schemas/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * What storefronts use: `client.analytics.cartItemAdded({ ... })`. Storefronts never know which vendors receive events.
 *
 * Every event comes from an explicit call here; other capabilities never emit analytics events on their own. Each helper
 * validates its payload, enqueues the event on the client's per-request dispatcher and returns its id without waiting for
 * any vendor. Delivery happens after the response via the dispatcher's `waitUntil`, or call {@link flush}.
 */
export class AnalyticsCapability extends BaseCapability {
  protected readonly dispatcher: AnalyticsDispatcher;

  constructor(cache: Cache, context: RequestContext, dispatcher: AnalyticsDispatcher) {
    super(cache, context);
    this.dispatcher = dispatcher;
  }

  protected override getResourceName(): string {
    return 'analytics';
  }

  /**
   * Delivers everything queued so far and resolves once delivery is done. For scripts, tests and
   * runtimes without `waitUntil`. Never rejects.
   */
  public async flush(): Promise<void> {
    await this.dispatcher.flush();
  }

  @Reactionary({ inputSchema: AnalyticsMutationPageViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async pageViewed(payload: AnalyticsMutationPageViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('page-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationSearchResultsViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async searchResultsViewed(payload: AnalyticsMutationSearchResultsViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('search-results-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationAutocompleteSuggestionSelectedSchema, outputSchema: AnalyticsEventResultSchema })
  public async autocompleteSuggestionSelected(payload: AnalyticsMutationAutocompleteSuggestionSelected): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('autocomplete-suggestion-selected', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCategoryViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async categoryViewed(payload: AnalyticsMutationCategoryViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('category-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationProductCarouselViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async productCarouselViewed(payload: AnalyticsMutationProductCarouselViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('product-carousel-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationProductClickedSchema, outputSchema: AnalyticsEventResultSchema })
  public async productClicked(payload: AnalyticsMutationProductClicked): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('product-clicked', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationProductViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async productViewed(payload: AnalyticsMutationProductViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('product-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationPromotionViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async promotionViewed(payload: AnalyticsMutationPromotionViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('promotion-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationPromotionClickedSchema, outputSchema: AnalyticsEventResultSchema })
  public async promotionClicked(payload: AnalyticsMutationPromotionClicked): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('promotion-clicked', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCartItemAddedSchema, outputSchema: AnalyticsEventResultSchema })
  public async cartItemAdded(payload: AnalyticsMutationCartItemAdded): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('cart-item-added', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCartItemRemovedSchema, outputSchema: AnalyticsEventResultSchema })
  public async cartItemRemoved(payload: AnalyticsMutationCartItemRemoved): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('cart-item-removed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCartItemQuantityChangedSchema, outputSchema: AnalyticsEventResultSchema })
  public async cartItemQuantityChanged(payload: AnalyticsMutationCartItemQuantityChanged): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('cart-item-quantity-changed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCartViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async cartViewed(payload: AnalyticsMutationCartViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('cart-viewed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCouponAppliedSchema, outputSchema: AnalyticsEventResultSchema })
  public async couponApplied(payload: AnalyticsMutationCouponApplied): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('coupon-applied', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCouponRejectedSchema, outputSchema: AnalyticsEventResultSchema })
  public async couponRejected(payload: AnalyticsMutationCouponRejected): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('coupon-rejected', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCheckoutStartedSchema, outputSchema: AnalyticsEventResultSchema })
  public async checkoutStarted(payload: AnalyticsMutationCheckoutStarted): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('checkout-started', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationShippingInfoAddedSchema, outputSchema: AnalyticsEventResultSchema })
  public async shippingInfoAdded(payload: AnalyticsMutationShippingInfoAdded): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('shipping-info-added', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationPaymentInfoAddedSchema, outputSchema: AnalyticsEventResultSchema })
  public async paymentInfoAdded(payload: AnalyticsMutationPaymentInfoAdded): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('payment-info-added', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationOrderPlacedSchema, outputSchema: AnalyticsEventResultSchema })
  public async orderPlaced(payload: AnalyticsMutationOrderPlaced): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('order-placed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationQuoteRequestedSchema, outputSchema: AnalyticsEventResultSchema })
  public async quoteRequested(payload: AnalyticsMutationQuoteRequested): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('quote-requested', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationOrderReorderedSchema, outputSchema: AnalyticsEventResultSchema })
  public async orderReordered(payload: AnalyticsMutationOrderReordered): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('order-reordered', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCompanyRegisteredSchema, outputSchema: AnalyticsEventResultSchema })
  public async companyRegistered(payload: AnalyticsMutationCompanyRegistered): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('company-registered', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationUserLoggedInSchema, outputSchema: AnalyticsEventResultSchema })
  public async userLoggedIn(payload: AnalyticsMutationUserLoggedIn): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('user-logged-in', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationUserLoggedOutSchema, outputSchema: AnalyticsEventResultSchema })
  public async userLoggedOut(payload: AnalyticsMutationUserLoggedOut): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('user-logged-out', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationUserRegisteredSchema, outputSchema: AnalyticsEventResultSchema })
  public async userRegistered(payload: AnalyticsMutationUserRegistered): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('user-registered', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationProfileUpdatedSchema, outputSchema: AnalyticsEventResultSchema })
  public async profileUpdated(payload: AnalyticsMutationProfileUpdated): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('profile-updated', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationConsentChangedSchema, outputSchema: AnalyticsEventResultSchema })
  public async consentChanged(payload: AnalyticsMutationConsentChanged): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('consent-changed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationNewsletterSubscribedSchema, outputSchema: AnalyticsEventResultSchema })
  public async newsletterSubscribed(payload: AnalyticsMutationNewsletterSubscribed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('newsletter-subscribed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationWishlistItemAddedSchema, outputSchema: AnalyticsEventResultSchema })
  public async wishlistItemAdded(payload: AnalyticsMutationWishlistItemAdded): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('wishlist-item-added', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationWishlistItemRemovedSchema, outputSchema: AnalyticsEventResultSchema })
  public async wishlistItemRemoved(payload: AnalyticsMutationWishlistItemRemoved): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('wishlist-item-removed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationBackInStockRequestedSchema, outputSchema: AnalyticsEventResultSchema })
  public async backInStockRequested(payload: AnalyticsMutationBackInStockRequested): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('back-in-stock-requested', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationReviewSubmittedSchema, outputSchema: AnalyticsEventResultSchema })
  public async reviewSubmitted(payload: AnalyticsMutationReviewSubmitted): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('review-submitted', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationStoreSelectedSchema, outputSchema: AnalyticsEventResultSchema })
  public async storeSelected(payload: AnalyticsMutationStoreSelected): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('store-selected', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationProductSharedSchema, outputSchema: AnalyticsEventResultSchema })
  public async productShared(payload: AnalyticsMutationProductShared): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('product-shared', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCustomSchema, outputSchema: AnalyticsEventResultSchema })
  public async custom(payload: AnalyticsMutationCustom): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('custom', payload);
  }
}
