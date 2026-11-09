import {
  AnalyticsProvider,
  categoryKey,
  productKey,
  summarizePlacedOrder,
  searchOriginOf,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsCategoryRef,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsProductRef,
  type AnalyticsPurpose,
  type Cache,
  type Cart,
  type CartItem,
  type Origin,
  type OriginCategory,
  type Product,
  type ProductIdentifier,
  type ProductVariantIdentifier,
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
 * Measurement Protocol hits only count as user activity in Realtime and in session and engagement reports when they
 * carry a session id and an engagement time. Sent on every event.
 */
const ENGAGEMENT_TIME_MSEC = 100;

/** Hits further apart than this start a new session, as GA4 does with its default session timeout. */
const SESSION_WINDOW_SECONDS = 30 * 60;

/**
 * The session id for events of storefronts that set no `session.id`: the start of the 30 minute window the event
 * happened in. The same visitor gets the same id for events in the same window, without anything having to be stored
 * between requests. A visit that straddles a window boundary is split into two sessions.
 *
 * GA4 ends a session after 30 minutes of inactivity, so its reports are only accurate when the storefront's own
 * session behaves similarly.
 */
export function sessionIdAt(occurredAt: string): string {
  const seconds = Math.floor(Date.parse(occurredAt) / 1000);
  return String(seconds - (seconds % SESSION_WINDOW_SECONDS));
}

/** UTM query parameters and the `campaign_details` parameter each one is sent as. */
const CAMPAIGN_PARAMETERS = {
  utm_id: 'campaign_id',
  utm_campaign: 'campaign',
  utm_source: 'source',
  utm_medium: 'medium',
  utm_term: 'term',
  utm_content: 'content',
} as const;

/** The campaign a landing URL was tagged with, if it carries any UTM parameter. */
function campaignDetails(url: string | undefined): Record<string, string> | undefined {
  if (!url) {
    return undefined;
  }
  let query: URLSearchParams;
  try {
    query = new URL(url).searchParams;
  } catch {
    return undefined;
  }
  const details: Record<string, string> = {};
  for (const [utm, param] of Object.entries(CAMPAIGN_PARAMETERS)) {
    const value = query.get(utm);
    if (value) {
      details[param] = value;
    }
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

/** The category listing an origin leads back to, looking through `fromPDP(upstream)`. */
function categoryOriginOf(origin: Origin | undefined): OriginCategory | undefined {
  if (origin?.type === 'category') {
    return origin;
  }
  if (origin?.type === 'pdp') {
    return categoryOriginOf(origin.upstream);
  }
  return undefined;
}

/** `Red / XL`: the option labels of the variant, or its name when it has no options. */
function variantLabel(product: Product, sku: string): string | undefined {
  const variant = [product.mainVariant, ...product.variants].find((candidate) => candidate.identifier.sku === sku);
  if (!variant) {
    return undefined;
  }
  const labels = variant.options.map((option) => option.value.label).filter(Boolean);
  return labels.length > 0 ? labels.join(' / ') : variant.name || undefined;
}

/** GA4 takes at most five category levels, as `item_category` and `item_category2`..`item_category5`. */
const MAX_CATEGORY_LEVELS = 5;

/**
 * Sends ecommerce events to GA4 through the Measurement Protocol.
 *
 * Item ids: variant-level events (cart, checkout, purchase) use the sku as `item_id`, with the product key as
 * `item_group_id`; product-level events (lists, clicks, product views) use the product key, as no sku is known there.
 *
 * Every item is enriched with name, brand, category hierarchy and, for variant-level events, the variant, so GA4 can
 * report on them. The product comes from the event when it carries one and from the analytics context otherwise; the
 * context memoizes lookups for the flush and goes through the cached capabilities. The categories are the breadcrumb of
 * the product's first parent category. A field that cannot be resolved is left out, the event is still sent.
 */
export class GoogleAnalyticsAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'page-viewed',
    'search-results-viewed',
    'product-clicked',
    'product-viewed',
    'category-viewed',
    'product-carousel-viewed',
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
      case 'page-viewed': {
        const referrer = event.context.page?.referrer;
        const campaign = campaignDetails(event.payload.page.url);
        return [
          // Applies to the events from its timestamp on, so it goes first. The Measurement Protocol does not read the
          // campaign from page_location the way the browser tag does.
          ...(campaign ? [{ name: 'campaign_details', params: campaign }] : []),
          {
            name: 'page_view',
            params: {
              page_location: event.payload.page.url,
              page_title: event.payload.page.title,
              ...(referrer ? { page_referrer: referrer } : {}),
            },
          },
        ];
      }

      case 'search-results-viewed': {
        const search = event.payload.search;
        const first = (search.paginationOptions.pageNumber - 1) * search.paginationOptions.pageSize;
        const items = await this.itemsForRefs(event.payload.products, ctx);
        return [
          { name: 'search', params: { search_term: search.term } },
          {
            name: 'view_item_list',
            params: {
              item_list_id: 'search',
              item_list_name: search.term ? `Search: ${search.term}` : 'Search',
              items: items.map((item, i) => ({ ...item, index: first + i })),
            },
          },
        ];
      }

      case 'category-viewed': {
        const refs = event.payload.products ?? [];
        if (refs.length === 0) {
          return [];
        }
        const [list, items] = await Promise.all([this.categoryList(event.payload.category, ctx), this.itemsForRefs(refs, ctx)]);
        return [{ name: 'view_item_list', params: { ...list, items } }];
      }

      case 'product-carousel-viewed': {
        const { carousel, products } = event.payload;
        if (products.length === 0) {
          return [];
        }
        const items = await this.itemsForRefs(products, ctx);
        return [
          {
            name: 'view_item_list',
            params: {
              item_list_id: carousel.recommendationId?.key ?? carousel.carouselName,
              item_list_name: carousel.carouselName,
              items: items.map((item, i) => ({ ...item, index: i })),
            },
          },
        ];
      }

      case 'product-clicked': {
        const [item] = await this.itemsForRefs([event.payload.product], ctx);
        const search = searchOriginOf(event.origin);
        const category = search ? undefined : categoryOriginOf(event.origin);
        const list = search
          ? { item_list_id: 'search', item_list_name: `Search: ${search.identifier.term}` }
          : category
            ? await this.categoryList(category.categoryId, ctx)
            : {};
        const position = search?.position ?? category?.position;
        return [{ name: 'select_item', params: { ...list, items: [{ ...item, ...(position === undefined ? {} : { index: position }) }] } }];
      }

      case 'product-viewed': {
        const [item] = await this.itemsForRefs([event.payload.product], ctx);
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
          return [await this.lineEvent('remove_from_cart', removed, event.payload.quantity ?? removed.quantity, event.payload.cart.price.grandTotal.currency, ctx)];
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
        return [await this.cartEvent('view_cart', event.payload.cart, ctx)];

      case 'checkout-started':
        return [await this.cartEvent('begin_checkout', event.payload.cart, ctx)];

      case 'shipping-info-added':
        return [await this.cartEvent('add_shipping_info', event.payload.cart, ctx, { shipping_tier: event.payload.shippingMethod?.name })];

      case 'payment-info-added':
        return [await this.cartEvent('add_payment_info', event.payload.cart, ctx, { payment_type: event.payload.paymentMethod.identifier.method })];

      case 'order-placed': {
        const placed = summarizePlacedOrder(event.payload);
        if (!placed) {
          return [];
        }
        const price = placed.price;
        return [
          {
            name: 'purchase',
            params: {
              currency: price.grandTotal.currency,
              transaction_id: placed.transactionId,
              value: price.grandTotal.value,
              tax: price.totalTax.value,
              shipping: price.totalShipping.value,
              items: await Promise.all(
                placed.items.map(async (item) => ({
                  ...(await this.variantItem(item.variant, ctx)),
                  quantity: item.quantity,
                  price: item.price.unitPrice.value,
                  discount: item.price.unitDiscount.value,
                }))
              ),
            },
          },
        ];
      }

      case 'wishlist-item-added':
        return [{ name: 'add_to_wishlist', params: { items: [await this.variantItem(event.payload.variant, ctx)] } }];

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

  private async cartEvent(name: string, cart: Cart, ctx: AnalyticsContext, params: Record<string, unknown> = {}): Promise<GaEvent> {
    return {
      name,
      params: {
        currency: cart.price.grandTotal.currency,
        value: cart.price.totalProductPrice.value,
        ...params,
        items: await Promise.all(cart.items.map((item) => this.cartItem(item, item.quantity, ctx))),
      },
    };
  }

  /** A cart line with the name, brand, categories and variant of its product. */
  private async cartItem(item: CartItem, quantity: number, ctx: AnalyticsContext): Promise<GaItem> {
    const product = await ctx.products.byId(item.product);
    return {
      item_id: item.variant.sku,
      item_group_id: item.product.key,
      quantity,
      price: item.price.unitPrice.value,
      discount: item.price.unitDiscount.value,
      ...(product.success ? await this.describeProduct(product.value, item.variant.sku, ctx) : {}),
    };
  }

  private async lineEvent(name: string, item: CartItem, quantity: number, currency: string, ctx: AnalyticsContext): Promise<GaEvent> {
    return {
      name,
      params: { currency, value: item.price.unitPrice.value * quantity, items: [await this.cartItem(item, quantity, ctx)] },
    };
  }

  /** add/remove of one line. Uses the line in the cart. */
  private async cartLineChange(name: string, cart: Cart, sku: string, quantity: number | undefined, ctx: AnalyticsContext): Promise<GaEvent[]> {
    const line = cart.items.find((item) => item.variant.sku === sku);
    if (!line) {
      return [];
    }
    return [await this.lineEvent(name, line, quantity ?? line.quantity, cart.price.grandTotal.currency, ctx)];
  }

  /** An item of a variant-level event that has no product key: the product is looked up by sku. */
  private async variantItem(variant: ProductVariantIdentifier, ctx: AnalyticsContext): Promise<GaItem> {
    const product = await ctx.products.bySku(variant);
    return {
      item_id: variant.sku,
      ...(product.success ? { item_group_id: product.value.identifier.key, ...(await this.describeProduct(product.value, variant.sku, ctx)) } : {}),
    };
  }

  /**
   * One item per ref, in order, with the product keyed as `item_id`. Products the refs do not carry are looked up
   * together, so the context can limit the concurrency.
   */
  private async itemsForRefs(refs: AnalyticsProductRef[], ctx: AnalyticsContext): Promise<GaItem[]> {
    const identifiers: ProductIdentifier[] = [];
    for (const ref of refs) {
      if (!('identifier' in ref)) {
        identifiers.push(ref);
      }
    }
    const found = await ctx.products.many(identifiers);

    let next = 0;
    return Promise.all(
      refs.map(async (ref) => {
        let product: Product | undefined;
        if ('identifier' in ref) {
          product = ref;
        } else {
          const result = found[next++];
          product = result?.success ? result.value : undefined;
        }
        return { item_id: productKey(ref), ...(product ? await this.describeProduct(product, undefined, ctx) : {}) };
      })
    );
  }

  /**
   * Name, brand, category hierarchy and, when a sku is given, the variant of a product. Empty values and anything that
   * cannot be resolved are left out.
   */
  private async describeProduct(product: Product, sku: string | undefined, ctx: AnalyticsContext): Promise<GaItem> {
    const variant = sku ? variantLabel(product, sku) : undefined;
    return {
      ...(product.name ? { item_name: product.name } : {}),
      ...(product.brand ? { item_brand: product.brand } : {}),
      ...(await this.categoryFields(product, ctx)),
      ...(variant ? { item_variant: variant } : {}),
    };
  }

  /** `item_category`..`item_category5`: the breadcrumb of the first parent category, root first. */
  private async categoryFields(product: Product, ctx: AnalyticsContext): Promise<GaItem> {
    const parent = product.parentCategories[0];
    if (!parent) {
      return {};
    }
    const path = await ctx.categories.path(parent);
    if (!path.success) {
      return {};
    }
    return Object.fromEntries(
      path.value.slice(0, MAX_CATEGORY_LEVELS).map((category, i) => [i === 0 ? 'item_category' : `item_category${i + 1}`, category.name])
    );
  }

  /** The list a category listing is reported as: its key, and its name when it can be resolved. */
  private async categoryList(ref: AnalyticsCategoryRef, ctx: AnalyticsContext): Promise<Record<string, string>> {
    const key = categoryKey(ref);
    let name: string | undefined;
    if ('identifier' in ref) {
      name = ref.name;
    } else {
      const category = await ctx.categories.byId(ref);
      name = category.success ? category.value.name : undefined;
    }
    return { item_list_id: key, ...(name ? { item_list_name: name } : {}) };
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
    const { identity, marketingIdentifier, clientIp, userAgent } = source.context;
    const url = `${this.config.url}?measurement_id=${this.config.measurementId}&api_secret=${this.config.apiSecret}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The request comes from the server, so GA4 would otherwise see the server as the visitor's device and location.
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      body: JSON.stringify({
        client_id: marketingIdentifier.key || 'anonymous',
        ip_override: clientIp,
        // An opaque, hashed id: GA4 must not receive anything that identifies the person.
        user_id: identity.type === 'Registered' ? hash('sha256', identity.id.userId) : undefined,
        timestamp_micros: Date.parse(source.occurredAt) * 1000,
        events: events.map((event) => ({
          ...event,
          params: { ...event.params, session_id: source.context.sessionId ?? sessionIdAt(source.occurredAt), engagement_time_msec: ENGAGEMENT_TIME_MSEC },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Analytics rejected '${source.type}' with status ${response.status}`);
    }
  }
}
