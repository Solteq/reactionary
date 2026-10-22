import {
  AnalyticsProvider,
  productKey,
  searchOriginOf,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsPurpose,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import {
  type InsightsClient,
  type ViewedObjectIDs,
  type ClickedObjectIDs,
  type ClickedObjectIDsAfterSearch,
  type AddedToCartObjectIDs,
  type AddedToCartObjectIDsAfterSearch,
  type PurchasedObjectIDs,
  type PurchasedObjectIDsAfterSearch,
  algoliasearch,
} from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaProductSearchIdentifierSchema } from '../schema/search.schema.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';
import { hash } from 'node:crypto';

/** Algolia accepts at most 20 objectIDs per insights event. */
const MAX_OBJECT_IDS_PER_EVENT = 20;

/**
 * Sends search insights to Algolia: result views, clicks, add-to-cart conversions and purchases. When the event's origin
 * leads back to a search with a `queryID` (looking through `fromPDP(upstream)`, so conversions on a PDP stay attributed to
 * the search that led there) the `...AfterSearch` event is sent with that query and, for clicks, the position. Without one
 * the plain click, add-to-cart and purchase events are sent, which still count but are not attributed to a search.
 */
export class AlgoliaAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'search-results-viewed',
    'product-clicked',
    'cart-item-added',
    'order-placed',
  ];

  public readonly purpose: AnalyticsPurpose = 'analytics';

  protected client: InsightsClient;
  protected config: AlgoliaConfiguration;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    config: AlgoliaConfiguration
  ) {
    super(cache, requestContext);

    this.config = config;
    this.client = algoliasearch(this.config.appId, this.config.apiKey).initInsights({});
  }

  protected override getResourceName(): string {
    return 'algolia-analytics';
  }

  public async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void> {
    switch (event.type) {
      case 'search-results-viewed':
        return this.searchResultsViewed(event);
      case 'product-clicked':
        return this.productClicked(event);
      case 'cart-item-added':
        return this.cartItemAdded(event);
      case 'order-placed':
        return this.orderPlaced(event, ctx);
      default:
        return 'ignored';
    }
  }

  private async searchResultsViewed(event: AnalyticsEvent<'search-results-viewed'>): Promise<AnalyticsOutcome> {
    const objectIDs = event.payload.products.map(productKey);
    if (objectIDs.length === 0) {
      return 'ignored';
    }

    const events: ViewedObjectIDs[] = [];
    for (let i = 0; i < objectIDs.length; i += MAX_OBJECT_IDS_PER_EVENT) {
      events.push({
        eventName: 'view',
        eventType: 'view',
        index: this.indexFor(event),
        objectIDs: objectIDs.slice(i, i + MAX_OBJECT_IDS_PER_EVENT),
        ...this.userFor(event),
        timestamp: this.timestampFor(event),
      });
    }

    await this.client.pushEvents({ events });
    return 'accepted';
  }

  private async productClicked(event: AnalyticsEvent<'product-clicked'>): Promise<AnalyticsOutcome> {
    const search = this.searchFor(event);
    const common = {
      eventName: 'click',
      eventType: 'click',
      index: this.indexFor(event),
      objectIDs: [productKey(event.payload.product)],
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies ClickedObjectIDs;

    const algoliaEvent: ClickedObjectIDsAfterSearch | ClickedObjectIDs = search
      ? {
          ...common,
          // Algolia positions are absolute and start at 1; origins are absolute and start at 0.
          positions: [search.position + 1],
          queryID: search.queryID,
        }
      : common;

    await this.client.pushEvents({ events: [algoliaEvent] });
    return 'accepted';
  }

  private async cartItemAdded(event: AnalyticsEvent<'cart-item-added'>): Promise<AnalyticsOutcome> {
    const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
    if (!line) {
      return 'ignored';
    }

    const search = this.searchFor(event);
    const common = {
      eventName: 'addToCart',
      eventType: 'conversion',
      eventSubtype: 'addToCart',
      index: this.indexFor(event),
      objectIDs: [line.product.key],
      objectData: [{ price: line.price.unitPrice.value, quantity: event.payload.quantity }],
      currency: line.price.unitPrice.currency,
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies AddedToCartObjectIDs;

    const algoliaEvent: AddedToCartObjectIDsAfterSearch | AddedToCartObjectIDs = search
      ? { ...common, queryID: search.queryID }
      : common;

    await this.client.pushEvents({ events: [algoliaEvent] });
    return 'accepted';
  }

  private async orderPlaced(event: AnalyticsEvent<'order-placed'>, ctx: AnalyticsContext): Promise<AnalyticsOutcome> {
    // The index holds products, while orders only know SKUs, so resolve each line's product.
    const lines = await Promise.all(
      event.payload.order.items.map(async (item) => {
        const product = await ctx.products.bySku(item.variant);
        return product.success ? { objectID: product.value.identifier.key, item } : undefined;
      }),
    );
    const resolved = lines.flatMap((line) => (line ? [line] : []));
    if (resolved.length === 0) {
      return 'ignored';
    }

    // Orders are usually not tied to a search; when the storefront passes a search origin, attribute the purchase to it.
    const search = this.searchFor(event);
    const total = event.payload.order.price.grandTotal;
    const common = {
      eventName: 'purchase',
      eventType: 'conversion',
      eventSubtype: 'purchase',
      index: this.indexFor(event),
      objectIDs: resolved.map((line) => line.objectID),
      currency: total.currency,
      value: total.value,
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies PurchasedObjectIDs;
    const objectData = resolved.map((line) => ({ price: line.item.price.unitPrice.value, quantity: line.item.quantity }));

    const algoliaEvent: PurchasedObjectIDsAfterSearch | PurchasedObjectIDs = search
      ? { ...common, objectData: objectData.map((data) => ({ ...data, queryID: search.queryID })) }
      : { ...common, objectData };

    await this.client.pushEvents({ events: [algoliaEvent] });
    return 'accepted';
  }

  /** The search the event leads back to, with the Algolia queryID of that search. Without a queryID nothing can be attributed. */
  private searchFor(event: AnalyticsEvent) {
    const origin = searchOriginOf(event.origin);
    const identifier = AlgoliaProductSearchIdentifierSchema.safeParse(origin?.identifier);
    if (!origin || !identifier.success || !identifier.data.key) {
      return undefined;
    }
    return { queryID: identifier.data.key, position: origin.position };
  }

  private indexFor(event: AnalyticsEvent): string {
    return getProductIndexNameForLocale(this.config.indexName, event.context.locale, this.config);
  }

  private timestampFor(event: AnalyticsEvent): number {
    return Date.parse(event.occurredAt);
  }

  /** User tokens from the request state at emit time, so a login between emit and delivery does not change them. */
  private userFor(event: AnalyticsEvent): { userToken: string; authenticatedUserToken?: string } {
    const { marketingIdentifier, identity } = event.context;
    return {
      userToken: marketingIdentifier.key || 'anonymous',
      authenticatedUserToken: identity.type === 'Registered' ? hash('sha256', identity.id.userId) : undefined,
    };
  }
}
