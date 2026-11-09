import { emitLegacyAnalyticsEvent } from '../analytics/legacy-adapter.js';
import type { AnalyticsDispatcher } from '../analytics/dispatcher.js';
import type { Cache } from '../cache/cache.interface.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';
import {
  AnalyticsEventResultSchema,
  AnalyticsMutationSchema,
  AnalyticsResultSchema,
  type AnalyticsMutation,
  type AnalyticsResult,
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
  AnalyticsMutationExperimentExposedSchema,
  AnalyticsMutationTraitDeclaredSchema,
  AnalyticsMutationCustomSchema,
  type AnalyticsEventResult,
  type AnalyticsMutationPageViewed,
  type AnalyticsMutationSearchResultsViewed,
  type AnalyticsMutationAutocompleteSuggestionSelected,
  type AnalyticsMutationCategoryViewed,
  type AnalyticsMutationProductCarouselViewed,
  type AnalyticsMutationProductClicked,
  type AnalyticsMutationProductViewed,
  type AnalyticsMutationContentViewed,
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
  type AnalyticsMutationExperimentExposed,
  type AnalyticsMutationTraitDeclared,
  type AnalyticsMutationCustom,
  type GenericError,
  type RequestContext,
  type Result,
} from '../schemas/index.js';
import { error } from '../schemas/result.js';
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

  /**
   * @deprecated Use the event helpers, e.g. `productViewed`, `cartItemAdded`, `orderPlaced`.
   *
   * Compatibility is at the API level only: the event is converted to its new equivalent and enqueued exactly like the helpers
   * do, with no immediate dispatch and no waiting on providers. The returned `AnalyticsResult` keeps its shape so callers
   * keep compiling, but its outcomes no longer reflect what providers did: it holds one `accepted` outcome for the analytics
   * capability when the event was enqueued, or `rejected` when it could not be (invalid input, or for `product-cart-add`
   * when the active cart or the product could not be looked up). A `personalizationProfile` on the legacy
   * event identifies the visitor for that event only. Prefer setting `session.marketingContext` to the resolved profile
   * and emitting through the helpers, which take no profile.
   */
  @Reactionary({ inputSchema: AnalyticsMutationSchema, outputSchema: AnalyticsResultSchema })
  public async track(event: AnalyticsMutation): Promise<AnalyticsResult> {
    const result = await emitLegacyAnalyticsEvent(event, this.dispatcher);
    return { outcomes: [{ provider: this.getResourceName(), outcome: result.success ? 'accepted' : 'rejected' }] };
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

  /**
   * A CMS article or page was viewed. The CMS is not a capability, so the caller passes the ids of the taxonomy
   * concepts the content is tagged with, which lets a provider record the interest of the visitor in them.
   * Pass the direct tags of the content only, not the closure over their ancestors (a provider takes the list as it
   * is, and an ancestor would count as interest of its own), most important first, as a provider that has to cap
   * the list keeps the first ones. At most 50 ids of at most 128 characters.
   */
  @Reactionary({ inputSchema: AnalyticsMutationContentViewedSchema, outputSchema: AnalyticsEventResultSchema })
  public async contentViewed(payload: AnalyticsMutationContentViewed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('content-viewed', payload);
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
    if (!payload.checkout && !payload.order) {
      return error<GenericError>({ type: 'Generic', message: 'orderPlaced needs a checkout (or the deprecated order)' });
    }
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

  @Reactionary({ inputSchema: AnalyticsMutationExperimentExposedSchema, outputSchema: AnalyticsEventResultSchema })
  public async experimentExposed(payload: AnalyticsMutationExperimentExposed): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('experiment-exposed', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationTraitDeclaredSchema, outputSchema: AnalyticsEventResultSchema })
  public async traitDeclared(payload: AnalyticsMutationTraitDeclared): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('trait-declared', payload);
  }

  @Reactionary({ inputSchema: AnalyticsMutationCustomSchema, outputSchema: AnalyticsEventResultSchema })
  public async custom(payload: AnalyticsMutationCustom): Promise<Result<AnalyticsEventResult>> {
    return this.dispatcher.emit('custom', payload);
  }
}
