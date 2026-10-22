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
import { hash } from 'node:crypto';
import { UnomiAPI } from '../core/client.js';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';

interface UnomiEvent {
  eventType: string;
  scope: string;
  target?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

/**
 * Sends behavioural events to Apache Unomi's context endpoint, attributed to the visitor's marketing profile.
 *
 * Events are attributed to the marketing identifier captured when the event was emitted. Without one there is no profile to
 * attribute to (Unomi would create a throwaway profile per request), so the event is ignored.
 */
export class UnomiAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'search-results-viewed',
    'product-carousel-viewed',
    'product-viewed',
    'product-clicked',
    'cart-item-added',
    'order-placed',
    'user-logged-in',
  ];

  /** A CDP builds visitor profiles for personalization. */
  public readonly purpose: AnalyticsPurpose = 'marketing';

  protected readonly api: UnomiAPI;

  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: UnomiConfiguration,
  ) {
    super(cache, context);
    this.api = new UnomiAPI(config, context);
  }

  protected override getResourceName(): string {
    return 'unomi-analytics';
  }

  public async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void> {
    const events = await this.toUnomiEvents(event, ctx);
    if (events.length === 0) {
      return 'ignored';
    }

    // A login is sent on the profile the visitor had before it, so Unomi can merge it with the logged in one.
    const profileId = event.type === 'user-logged-in'
      ? (event.payload.previousMarketingId?.key || event.context.marketingIdentifier.key)
      : event.context.marketingIdentifier.key;
    if (!profileId) {
      return 'ignored';
    }

    await this.postEvents(profileId, events);
    return 'accepted';
  }

  protected async toUnomiEvents(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<UnomiEvent[]> {
    const scope = this.config.scope;

    switch (event.type) {
      case 'search-results-viewed':
      case 'product-carousel-viewed':
        return event.payload.products.map((product) => ({
          eventType: 'product_view',
          scope,
          target: { itemId: productKey(product), itemType: 'product' },
        }));

      case 'product-viewed':
        return [{ eventType: 'product_view', scope, target: { itemId: productKey(event.payload.product), itemType: 'product' } }];

      case 'product-clicked': {
        const search = searchOriginOf(event.origin);
        return [
          {
            eventType: 'selectItem',
            scope,
            target: { itemId: productKey(event.payload.product), itemType: 'product' },
            properties: search ? { index: search.position, searchTerm: search.identifier.term } : undefined,
          },
        ];
      }

      case 'cart-item-added': {
        const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
        if (!line) {
          return [];
        }
        const product = await ctx.products.byId(line.product);
        return [
          {
            eventType: 'addToCart',
            scope,
            target: {
              itemId: line.product.key,
              itemType: 'product',
              customItemType: 'product',
              properties: {
                sku: line.variant.sku,
                price: line.price.unitPrice.value,
                currency: line.price.unitPrice.currency,
                quantity: event.payload.quantity,
                ...(product.success ? { productName: product.value.name } : {}),
              },
            },
          },
        ];
      }

      case 'order-placed': {
        const order = event.payload.order;
        return [
          {
            eventType: 'purchaseComplete',
            scope,
            target: { itemId: order.identifier.key, itemType: 'order' },
            properties: {
              orderId: order.identifier.key,
              totalAmount: order.price.grandTotal.value,
              currency: order.price.grandTotal.currency,
              itemCount: order.items.length,
              items: order.items.map((item) => ({
                sku: item.variant.sku,
                quantity: item.quantity,
                price: item.price.unitPrice.value,
              })),
            },
          },
        ];
      }

      case 'user-logged-in': {
        const identity = event.payload.identity;
        return [
          {
            eventType: 'login',
            scope,
            // An opaque hash: the CDP should not receive the backend user id itself.
            properties: identity.type === 'Anonymous' ? undefined : { userId: hash('sha256', identity.id.userId) },
          },
        ];
      }

      default:
        return [];
    }
  }

  protected async postEvents(profileId: string, events: UnomiEvent[]): Promise<void> {
    const response = await this.api.postEvent({
      source: {
        itemType: 'page',
        scope: this.config.scope,
        itemId: 'backend',
      },
      profileId,
      events,
    });

    if (!response.ok) {
      throw new Error(`Unomi event request failed with status ${response.status}`);
    }
  }
}
