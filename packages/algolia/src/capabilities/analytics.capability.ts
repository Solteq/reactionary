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
  type ClickedObjectIDsAfterSearch,
  type AddedToCartObjectIDsAfterSearch,
  type PurchasedObjectIDs,
  algoliasearch,
} from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaProductSearchIdentifierSchema } from '../schema/search.schema.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';
import { hash } from 'node:crypto';

/** Algolia accepts at most 20 objectIDs per insights event. */
const MAX_OBJECT_IDS_PER_EVENT = 20;

/**
 * Sends search insights to Algolia: result views, clicks and add-to-cart conversions attributed to the search
 * they came from, and purchases. Attribution needs the `queryID` of the search, which it takes from the event's origin
 * (looking through `fromPDP(upstream)`), so conversions on a PDP stay attributed to the search that led there.
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
    if (!search) {
      return 'ignored';
    }

    const algoliaEvent = {
      eventName: 'click',
      eventType: 'click',
      index: this.indexFor(event),
      objectIDs: [productKey(event.payload.product)],
      // Algolia positions are absolute and start at 1; origins are absolute and start at 0.
      positions: [search.position + 1],
      queryID: search.queryID,
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies ClickedObjectIDsAfterSearch;

    await this.client.pushEvents({ events: [algoliaEvent] });
    return 'accepted';
  }

  private async cartItemAdded(event: AnalyticsEvent<'cart-item-added'>): Promise<AnalyticsOutcome> {
    const search = this.searchFor(event);
    const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
    if (!search || !line) {
      return 'ignored';
    }

    const algoliaEvent = {
      eventName: 'addToCart',
      eventType: 'conversion',
      eventSubtype: 'addToCart',
      index: this.indexFor(event),
      objectIDs: [line.product.key],
      objectData: [{ price: line.price.unitPrice.value, quantity: event.payload.quantity }],
      currency: line.price.unitPrice.currency,
      queryID: search.queryID,
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies AddedToCartObjectIDsAfterSearch;

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

    const total = event.payload.order.price.grandTotal;
    const algoliaEvent = {
      eventName: 'purchase',
      eventType: 'conversion',
      eventSubtype: 'purchase',
      index: this.indexFor(event),
      objectIDs: resolved.map((line) => line.objectID),
      objectData: resolved.map((line) => ({ price: line.item.price.unitPrice.value, quantity: line.item.quantity })),
      currency: total.currency,
      value: total.value,
      ...this.userFor(event),
      timestamp: this.timestampFor(event),
    } satisfies PurchasedObjectIDs;

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
