import {
  AnalyticsProvider,
  productKey,
  searchOriginOf,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsProductRef,
  type AnalyticsPurpose,
  type Cache,
  type Cart,
  type CartItem,
  type RequestContext,
} from '@reactionary/core';
import { hash } from 'node:crypto';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';

type GaItem = Record<string, unknown>;
interface GaEvent {
  name: string;
  params: Record<string, unknown>;
}

/**
 * Sends ecommerce events to GA4 through the Measurement Protocol.
 *
 * Item ids: variant-level events (cart, checkout, purchase) use the sku as `item_id`, with the product key as
 * `item_group_id`; product-level events (lists, clicks, product views) use the product key, as no sku is known there.
 * Only single-product events look the product up for its name and brand; list, cart and order events send ids,
 * quantities and prices only, so a request never triggers dozens of lookups just for analytics.
 */
export class GoogleAnalyticsAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'page-viewed',
    'search-results-viewed',
    'product-clicked',
    'product-viewed',
    'promotion-viewed',
    'promotion-clicked',
    'cart-item-added',
    'cart-item-removed',
    'cart-item-quantity-changed',
    'cart-viewed',
    'checkout-started',
    'shipping-info-added',
    'payment-info-added',
    'order-placed',
    'wishlist-item-added',
    'product-shared',
    'user-logged-in',
    'user-registered',
  ];

  public readonly purpose: AnalyticsPurpose = 'analytics';

  protected config: GoogleAnalyticsConfiguration;

  constructor(
    cache: Cache,
    context: RequestContext,
    configuration: GoogleAnalyticsConfiguration
  ) {
    super(cache, context);

    this.config = configuration;
  }

  protected override getResourceName(): string {
    return 'google-analytics';
  }

  public async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void> {
    const events = await this.toGaEvents(event, ctx);
    if (events.length === 0) {
      return 'ignored';
    }

    await this.sendEvents(event, events);
    return 'accepted';
  }

  protected async toGaEvents(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<GaEvent[]> {
    const currency = event.context.currency;

    switch (event.type) {
      case 'page-viewed':
        return [{ name: 'page_view', params: { page_location: event.payload.page.url, page_title: event.payload.page.title } }];

      case 'search-results-viewed': {
        const search = event.payload.search;
        const first = (search.paginationOptions.pageNumber - 1) * search.paginationOptions.pageSize;
        return [
          { name: 'search', params: { search_term: search.term } },
          {
            name: 'view_item_list',
            params: {
              item_list_id: 'search',
              item_list_name: search.term ? `Search: ${search.term}` : 'Search',
              items: event.payload.products.map((product, i) => ({ item_id: productKey(product), index: first + i })),
            },
          },
        ];
      }

      case 'product-clicked': {
        const item = await this.productItem(event.payload.product, ctx);
        const search = searchOriginOf(event.origin);
        return [
          {
            name: 'select_item',
            params: {
              ...(search ? { item_list_id: 'search', item_list_name: `Search: ${search.identifier.term}` } : {}),
              items: [{ ...item, ...(search ? { index: search.position } : {}) }],
            },
          },
        ];
      }

      case 'product-viewed': {
        const item = await this.productItem(event.payload.product, ctx);
        const prices = await this.productPrice(event.payload.product, ctx);
        return [
          {
            name: 'view_item',
            params: { currency: prices?.currency ?? currency, ...(prices ? { value: prices.value } : {}), items: [{ ...item, ...(prices ? { price: prices.value } : {}) }] },
          },
        ];
      }

      case 'promotion-viewed':
      case 'promotion-clicked':
        return [
          {
            name: event.type === 'promotion-viewed' ? 'view_promotion' : 'select_promotion',
            params: {
              promotion_id: event.payload.promotion.id,
              promotion_name: event.payload.promotion.name,
              creative_slot: event.payload.promotion.slot,
              creative_name: event.payload.promotion.creative,
            },
          },
        ];

      case 'cart-item-added':
        return this.cartLineChange('add_to_cart', event.payload.cart, event.payload.variant.sku, event.payload.quantity, ctx);

      case 'cart-item-removed': {
        const removed = event.payload.removed;
        if ('quantity' in removed) {
          return [this.lineEvent('remove_from_cart', removed, event.payload.quantity ?? removed.quantity, event.payload.cart.price.grandTotal.currency)];
        }
        return this.cartLineChange('remove_from_cart', event.payload.cart, removed.sku, event.payload.quantity, ctx);
      }

      case 'cart-item-quantity-changed': {
        const delta = event.payload.newQuantity - event.payload.previousQuantity;
        if (delta === 0) {
          return [];
        }
        return this.cartLineChange(delta > 0 ? 'add_to_cart' : 'remove_from_cart', event.payload.cart, event.payload.variant.sku, Math.abs(delta), ctx);
      }

      case 'cart-viewed':
        return [this.cartEvent('view_cart', event.payload.cart)];

      case 'checkout-started':
        return [this.cartEvent('begin_checkout', event.payload.cart)];

      case 'shipping-info-added':
        return [this.cartEvent('add_shipping_info', event.payload.cart, { shipping_tier: event.payload.shippingMethod?.name })];

      case 'payment-info-added':
        return [this.cartEvent('add_payment_info', event.payload.cart, { payment_type: event.payload.paymentMethod.identifier.method })];

      case 'order-placed': {
        const price = event.payload.order.price;
        return [
          {
            name: 'purchase',
            params: {
              currency: price.grandTotal.currency,
              transaction_id: event.payload.order.identifier.key,
              value: price.grandTotal.value,
              tax: price.totalTax.value,
              shipping: price.totalShipping.value,
              items: event.payload.order.items.map((item) => ({
                item_id: item.variant.sku,
                quantity: item.quantity,
                price: item.price.unitPrice.value,
                discount: item.price.unitDiscount.value,
              })),
            },
          },
        ];
      }

      case 'wishlist-item-added':
        return [{ name: 'add_to_wishlist', params: { items: [{ item_id: event.payload.variant.sku }] } }];

      case 'product-shared':
        return [
          { name: 'share', params: { method: event.payload.channel, content_type: 'product', item_id: productKey(event.payload.product) } },
        ];

      case 'user-logged-in':
        return [{ name: 'login', params: {} }];

      case 'user-registered':
        return [{ name: 'sign_up', params: {} }];

      default:
        return [];
    }
  }

  private cartEvent(name: string, cart: Cart, params: Record<string, unknown> = {}): GaEvent {
    return {
      name,
      params: {
        currency: cart.price.grandTotal.currency,
        value: cart.price.totalProductPrice.value,
        ...params,
        items: cart.items.map((item) => this.cartItem(item, item.quantity)),
      },
    };
  }

  private cartItem(item: CartItem, quantity: number): GaItem {
    return {
      item_id: item.variant.sku,
      item_group_id: item.product.key,
      quantity,
      price: item.price.unitPrice.value,
      discount: item.price.unitDiscount.value,
    };
  }

  private lineEvent(name: string, item: CartItem, quantity: number, currency: string): GaEvent {
    return {
      name,
      params: { currency, value: item.price.unitPrice.value * quantity, items: [this.cartItem(item, quantity)] },
    };
  }

  /** add/remove of one line. Uses the line in the cart, and a product lookup for its name. */
  private async cartLineChange(name: string, cart: Cart, sku: string, quantity: number | undefined, ctx: AnalyticsContext): Promise<GaEvent[]> {
    const line = cart.items.find((item) => item.variant.sku === sku);
    if (!line) {
      return [];
    }
    const base = this.lineEvent(name, line, quantity ?? line.quantity, cart.price.grandTotal.currency);
    const product = await ctx.products.byId(line.product);
    const [item] = base.params['items'] as GaItem[];
    return [
      {
        ...base,
        params: { ...base.params, items: [{ ...item, ...(product.success ? { item_name: product.value.name, item_brand: product.value.brand } : {}) }] },
      },
    ];
  }

  private async productItem(ref: AnalyticsProductRef, ctx: AnalyticsContext): Promise<GaItem> {
    const key = productKey(ref);
    const product = 'identifier' in ref ? ref : await this.lookupProduct(key, ctx);
    return { item_id: key, ...(product ? { item_name: product.name, item_brand: product.brand } : {}) };
  }

  private async lookupProduct(key: string, ctx: AnalyticsContext) {
    const product = await ctx.products.byId({ key });
    return product.success ? product.value : undefined;
  }

  /** The customer price of the product's main variant, if it can be resolved. */
  private async productPrice(ref: AnalyticsProductRef, ctx: AnalyticsContext): Promise<{ value: number; currency: string } | undefined> {
    const product = 'identifier' in ref ? ref : await this.lookupProduct(productKey(ref), ctx);
    if (!product) {
      return undefined;
    }
    const prices = await ctx.prices.forSku(product.mainVariant.identifier);
    const price = prices.success ? (prices.value.customer ?? prices.value.list) : undefined;
    return price ? { value: price.unitPrice.value, currency: price.unitPrice.currency } : undefined;
  }

  protected async sendEvents(source: AnalyticsEvent, events: GaEvent[]): Promise<void> {
    const { identity, marketingIdentifier } = source.context;
    const url = `${this.config.url}?measurement_id=${this.config.measurementId}&api_secret=${this.config.apiSecret}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: marketingIdentifier.key || 'anonymous',
        // An opaque, hashed id: GA4 must not receive anything that identifies the person.
        user_id: identity.type === 'Registered' ? hash('sha256', identity.id.userId) : undefined,
        timestamp_micros: Date.parse(source.occurredAt) * 1000,
        events,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Analytics rejected '${source.type}' with status ${response.status}`);
    }
  }
}
