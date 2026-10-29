import {
  categoryKey,
  productKey,
  storeKey,
  summarizePlacedOrder,
  type AnalyticsCategoryRef,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsProductRef,
  type AnalyticsStoreRef,
  type Cart,
  type Category,
  type CategoryIdentifier,
  type Product,
  type ProductVariantIdentifier,
  type Store,
} from '@reactionary/core';
import { hash } from 'node:crypto';
import {
  UNOMI_ITEM_ID_PATTERN,
  eventDefinitions,
  itemDefinitions,
  unomiItemId,
  type EventDefinition,
  type ItemDefinition,
} from '../contract/index.js';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';
import { toEur, type EurRate } from './fx.js';
import { deviceClass, flattenOrigin } from './origin.js';

export interface UnomiItemPayload {
  itemType: string;
  itemId: string;
  scope: string;
  properties: Record<string, unknown>;
}

/** An event as it is posted to Unomi's context endpoint. */
export interface UnomiEvent {
  eventType: string;
  scope: string;
  /** The id of the reactionary event, so a resend replaces it instead of counting twice. */
  itemId: string;
  timeStamp: string;
  source: { itemType: 'site'; itemId: string; scope: string };
  target?: UnomiItemPayload;
  properties?: Record<string, unknown>;
}

interface Money {
  readonly value: number;
  readonly currency: string;
}

/** What a case of the mapping produces; the envelope is added around it. */
interface Mapped {
  readonly eventType: string;
  readonly target?: UnomiItemPayload;
  /** Properties of this event beyond the common ones. */
  readonly properties?: Record<string, unknown>;
  /** A Unomi built-in event (`view`, `login`): its own schema, no common properties. */
  readonly builtIn?: boolean;
}

const EVENT_TYPES: Readonly<Record<string, EventDefinition>> = Object.fromEntries(eventDefinitions.map((d: EventDefinition) => [d.name, d]));
const ITEM_TYPES: Readonly<Record<string, ItemDefinition>> = Object.fromEntries(itemDefinitions.map((d: ItemDefinition) => [d.name, d]));

const warned = new Map<string, number>();
const WARN_EVERY_MS = 60 * 1000;

/** At most one warning per event type per minute, and never with a value in it. */
function warnOnce(eventType: string, problems: readonly string[]): void {
  const now = Date.now();
  if ((warned.get(eventType) ?? 0) + WARN_EVERY_MS > now) {
    return;
  }
  warned.set(eventType, now);
  console.warn(`Unomi event ${eventType} left out, it does not match the contract: ${problems.join(', ')}`);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** An address without its query string and fragment: they carry tokens, search terms and tracking parameters. */
function withoutQuery(address: string | undefined): string | undefined {
  if (!address) {
    return undefined;
  }
  try {
    const url = new URL(address);
    return `${url.origin}${url.pathname}`;
  } catch {
    return address.split(/[?#]/)[0];
  }
}

const LINE_CONCURRENCY = 5;

/** `fn` over the items, at most `limit` at a time, the results in the order of the items. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function isProduct(ref: AnalyticsProductRef): ref is Product {
  return 'identifier' in ref;
}

function isCategory(ref: AnalyticsCategoryRef): ref is Category {
  return 'identifier' in ref;
}

function isStore(ref: AnalyticsStoreRef): ref is Store {
  return 'identifier' in ref;
}

/** Whether the event breaks the contract, as a list of problems that name fields and never values. */
export function contractProblems(mapped: Mapped, properties: Record<string, unknown> | undefined): string[] {
  const problems: string[] = [];
  const definition = EVENT_TYPES[mapped.eventType];
  if (!definition) {
    return mapped.builtIn ? [] : [`no schema for the event type ${mapped.eventType}`];
  }
  const shape = definition.properties.shape;
  for (const key of Object.keys(properties ?? {})) {
    if (!(key in shape)) {
      problems.push(`properties.${key} is not in the contract`);
    }
  }
  const checked = definition.properties.safeParse(properties ?? {});
  if (!checked.success) {
    problems.push(...checked.error.issues.map((i) => `properties.${i.path.join('.')} ${i.code}`));
  }

  if (definition.target === undefined) {
    if (mapped.target) {
      problems.push('the event has no target');
    }
    return problems;
  }
  if (!mapped.target || mapped.target.itemType !== definition.target) {
    return [...problems, `the target must be a ${definition.target}`];
  }
  const item = ITEM_TYPES[definition.target];
  if (!UNOMI_ITEM_ID_PATTERN.test(mapped.target.itemId)) {
    problems.push('target.itemId is not an id Unomi accepts');
  }
  if (item.itemIdPattern && !new RegExp(item.itemIdPattern).test(mapped.target.itemId)) {
    problems.push(`target.itemId does not have the form of a ${item.name}`);
  }
  for (const key of Object.keys(mapped.target.properties)) {
    if (!(key in item.properties.shape)) {
      problems.push(`target.properties.${key} is not in the contract`);
    }
  }
  const target = item.properties.safeParse(mapped.target.properties);
  if (!target.success) {
    problems.push(...target.error.issues.map((i) => `target.properties.${i.path.join('.')} ${i.code}`));
  }
  return problems;
}

/**
 * Turns one reactionary analytics event into the Unomi event of the contract (see `contract/`), looking up what the event does not
 * carry: product names, categories, concepts, prices, stores. A lookup that fails sends fewer fields, not no event.
 */
export class UnomiEventMapper {
  /** Set when an EUR amount was written, so the rate that made it goes on the event. */
  private usedRate = false;

  constructor(
    private readonly event: AnalyticsEvent,
    private readonly ctx: AnalyticsContext,
    private readonly config: UnomiConfiguration,
    private readonly rate: EurRate | undefined,
  ) {}

  /** The Unomi event, or undefined when the event is not sent or does not match the contract. */
  public async map(): Promise<UnomiEvent | undefined> {
    const mapped = await this.mapCase();
    if (!mapped) {
      return undefined;
    }
    const properties = mapped.builtIn ? mapped.properties : { ...this.commonProperties(), ...mapped.properties };
    const problems = contractProblems(mapped, properties);
    if (problems.length > 0) {
      warnOnce(mapped.eventType, problems);
      return undefined;
    }
    const scope = this.config.scope;
    return {
      eventType: mapped.eventType,
      scope,
      itemId: this.event.id,
      timeStamp: this.event.occurredAt,
      source: { itemType: 'site', itemId: this.config.sourceId, scope },
      ...(mapped.target ? { target: mapped.target } : {}),
      ...(properties && Object.keys(properties).length > 0 ? { properties } : {}),
    };
  }

  // ---- the cases ----------------------------------------------------------------------------------------------------

  private async mapCase(): Promise<Mapped | undefined> {
    const event = this.event;
    switch (event.type) {
      case 'page-viewed':
        return this.pageViewed(event.payload.page.url, event.payload.page.title);
      case 'product-viewed':
        return { eventType: 'productViewed', target: await this.productTarget(event.payload.product) };
      case 'product-clicked':
        return { eventType: 'productClicked', target: await this.productTarget(event.payload.product) };
      case 'category-viewed':
        return { eventType: 'categoryViewed', target: await this.categoryTarget(event.payload.category) };
      case 'content-viewed':
        return {
          eventType: 'contentViewed',
          target: this.item('content', event.payload.content.key, {
            contentType: event.payload.content.type,
            conceptIds: unique(event.payload.concepts.filter((c) => c.length <= 128)).slice(0, 50),
          }),
        };
      case 'promotion-clicked':
        return {
          eventType: 'promotionClicked',
          target: this.item('promotion', event.payload.promotion.id, {
            name: event.payload.promotion.name,
            slot: event.payload.promotion.slot,
            creative: event.payload.promotion.creative,
          }),
        };
      case 'cart-item-added': {
        const line = event.payload.cart.items.find((i) => i.variant.sku === event.payload.variant.sku);
        const target = await this.lineTarget(event.payload.variant, event.payload.quantity, line?.price.unitPrice);
        return { eventType: 'cartItemAdded', target, properties: this.cartSnapshot(event.payload.cart) };
      }
      case 'cart-item-removed': {
        const removed = event.payload.removed;
        const variant = 'variant' in removed ? removed.variant : removed;
        const line = 'variant' in removed ? removed : event.payload.cart.items.find((i) => i.variant.sku === variant.sku);
        const quantity = event.payload.quantity ?? (line ? line.quantity : 1);
        const target = await this.lineTarget(variant, quantity, line?.price.unitPrice);
        return { eventType: 'cartItemRemoved', target, properties: this.cartSnapshot(event.payload.cart) };
      }
      case 'coupon-applied':
        return { eventType: 'couponApplied', target: this.cartTarget(event.payload.cart), properties: { code: event.payload.code } };
      case 'checkout-started':
        return { eventType: 'checkoutStarted', target: this.cartTarget(event.payload.cart) };
      case 'quote-requested':
        return { eventType: 'quoteRequested', target: this.cartTarget(event.payload.cart) };
      case 'order-placed': {
        const target = await this.orderTarget(event.payload);
        return target ? { eventType: 'orderPlaced', target } : undefined;
      }
      case 'order-reordered': {
        const target = await this.orderTarget({ order: event.payload.order });
        return target ? { eventType: 'orderReordered', target } : undefined;
      }
      case 'wishlist-item-added':
        return { eventType: 'wishlistItemAdded', target: await this.variantTarget(event.payload.variant) };
      case 'back-in-stock-requested':
        return { eventType: 'backInStockRequested', target: await this.variantTarget(event.payload.variant) };
      case 'store-selected':
        return { eventType: 'storeSelected', target: await this.storeTarget(event.payload.store) };
      case 'review-submitted':
        return { eventType: 'reviewSubmitted', target: await this.productTarget(event.payload.product), properties: { rating: event.payload.rating } };
      case 'product-shared':
        return { eventType: 'productShared', target: await this.productTarget(event.payload.product), properties: { channel: event.payload.channel } };
      case 'newsletter-subscribed':
        return { eventType: 'newsletterSubscribed', properties: { channel: event.payload.channel } };
      case 'user-registered':
        return { eventType: 'userRegistered' };
      case 'company-registered':
        return { eventType: 'companyRegistered' };
      case 'experiment-exposed':
        return {
          eventType: 'experimentExposed',
          target: this.itemWithId('experiment', `exp.${event.payload.experimentKey}.${event.payload.version}`, {
            experimentKey: event.payload.experimentKey,
            version: event.payload.version,
          }),
        };
      case 'trait-declared':
        return {
          eventType: 'traitDeclared',
          target: this.itemWithId('trait', `${event.payload.trait}.${event.payload.value}`, { trait: event.payload.trait, value: event.payload.value }),
        };
      case 'user-logged-in': {
        const identity = event.payload.identity;
        if (identity.type === 'Anonymous') {
          return undefined;
        }
        // An opaque hash: the CDP never receives the backend user id, and it is the key profiles are merged on.
        return { eventType: 'login', builtIn: true, properties: { userId: hash('sha256', identity.id.userId) } };
      }
      default:
        return undefined;
    }
  }

  // ---- envelope and common pieces -------------------------------------------------------------------------------------

  private commonProperties(): Record<string, unknown> {
    const context = this.event.context;
    return {
      locale: context.locale,
      currency: context.currency,
      device: deviceClass(context.userAgent),
      origin: this.event.origin ? flattenOrigin(this.event.origin) : undefined,
      ...(this.usedRate && this.rate ? { fxRate: this.rate.rate, fxDate: this.rate.date } : {}),
    };
  }

  /** An amount in EUR, when it is in the currency of the request and there is a rate. */
  private eur(amount: Money | undefined): number | undefined {
    if (!amount || !this.rate || amount.currency !== this.event.context.currency) {
      return undefined;
    }
    this.usedRate = true;
    return toEur(amount.value, this.rate);
  }

  /** `unomiItemId` keeps a key Unomi accepts and hashes the rest, and the same key always gets the same id. */
  private item(itemType: string, key: string, properties: Record<string, unknown>): UnomiItemPayload {
    return this.itemWithId(itemType, unomiItemId(key), properties);
  }

  private itemWithId(itemType: string, itemId: string, properties: Record<string, unknown>): UnomiItemPayload {
    return { itemType, itemId, scope: this.config.scope, properties };
  }

  private pageViewed(url: string | undefined, title: string | undefined): Mapped | undefined {
    if (!url) {
      return undefined;
    }
    let path = url;
    try {
      path = new URL(url, 'https://placeholder.invalid').pathname;
    } catch {
      // keep the url as the path
    }
    const itemId = unomiItemId(path);
    return {
      eventType: 'view',
      builtIn: true,
      target: this.itemWithId('page', itemId, {
        pageInfo: {
          pageID: itemId,
          pagePath: path,
          pageName: title,
          destinationURL: withoutQuery(url),
          referringURL: withoutQuery(this.event.context.page?.referrer),
          language: this.event.context.locale,
        },
      }),
    };
  }

  // ---- products, lines, categories -----------------------------------------------------------------------------------

  /** The categories of a product and all their parents, from the root down. */
  private async categoryIds(parents: readonly CategoryIdentifier[]): Promise<string[]> {
    const found = new Map<string, Category | undefined>();
    for (const parent of parents) {
      const path = await this.ctx.categories.path(parent);
      if (path.success && path.value.length > 0) {
        path.value.forEach((c) => found.set(c.identifier.key, c));
      } else {
        found.set(parent.key, undefined);
      }
    }
    const depth = (key: string, seen = new Set<string>()): number => {
      const parent = found.get(key)?.parentCategory?.key;
      return parent && found.has(parent) && !seen.has(parent) ? 1 + depth(parent, seen.add(key)) : 0;
    };
    return [...found.keys()].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  }

  private async productProperties(product: Product | undefined, key: string, priced?: { unit: Money; onSale?: boolean }): Promise<Record<string, unknown>> {
    const price = priced ?? (product ? await this.priceOf(product) : undefined);
    return {
      name: product?.name || key,
      brand: product?.brand || undefined,
      productType: product?.productType?.identifier.key,
      categoryIds: await this.categoryIds(product?.parentCategories ?? []),
      conceptIds: unique((product?.concepts ?? []).map((c) => c.identifier.key).filter((id) => id.length <= 128)),
      price: price?.unit.value,
      priceEur: this.eur(price?.unit),
      currency: price?.unit.currency,
      onSale: price?.onSale,
    };
  }

  private async priceOf(product: Product): Promise<{ unit: Money; onSale: boolean } | undefined> {
    const prices = await this.ctx.prices.forSku(product.mainVariant.identifier);
    const price = prices.success ? (prices.value.customer ?? prices.value.list) : undefined;
    return price ? { unit: price.unitPrice, onSale: price.onSale } : undefined;
  }

  private async resolve(ref: AnalyticsProductRef): Promise<{ key: string; product?: Product }> {
    if (isProduct(ref)) {
      return { key: ref.identifier.key, product: ref };
    }
    const found = await this.ctx.products.byId(ref);
    return { key: productKey(ref), product: found.success ? found.value : undefined };
  }

  private async resolveVariant(variant: ProductVariantIdentifier): Promise<{ key: string; product?: Product }> {
    const found = await this.ctx.products.bySku(variant);
    return found.success ? { key: found.value.identifier.key, product: found.value } : { key: variant.sku };
  }

  private async productTarget(ref: AnalyticsProductRef): Promise<UnomiItemPayload> {
    const { key, product } = await this.resolve(ref);
    return this.item('product', key, await this.productProperties(product, key));
  }

  private async variantTarget(variant: ProductVariantIdentifier): Promise<UnomiItemPayload> {
    const { key, product } = await this.resolveVariant(variant);
    return this.item('product', key, await this.productProperties(product, key));
  }

  private async lineProperties(key: string, product: Product | undefined, sku: string, quantity: number, unit: Money | undefined): Promise<Record<string, unknown>> {
    return {
      ...(await this.productProperties(product, key, unit ? { unit } : undefined)),
      sku,
      quantity,
      unitPrice: unit?.value,
      unitPriceEur: this.eur(unit),
    };
  }

  private async lineTarget(variant: ProductVariantIdentifier, quantity: number, unit: Money | undefined): Promise<UnomiItemPayload> {
    const { key, product } = await this.resolveVariant(variant);
    return this.item('line', key, await this.lineProperties(key, product, variant.sku, quantity, unit));
  }

  private async categoryTarget(ref: AnalyticsCategoryRef): Promise<UnomiItemPayload> {
    const key = categoryKey(ref);
    const identifier: CategoryIdentifier = isCategory(ref) ? ref.identifier : ref;
    const category = isCategory(ref) ? ref : await this.ctx.categories.byId(ref).then((r) => (r.success ? r.value : undefined));
    return this.item('category', key, { name: category?.name || key, categoryIds: await this.categoryIds([identifier]) });
  }

  private async storeTarget(ref: AnalyticsStoreRef): Promise<UnomiItemPayload> {
    const key = storeKey(ref);
    const store = isStore(ref) ? ref : await this.ctx.stores.byId(ref).then((r) => (r.success ? r.value : undefined));
    const country = store?.address?.countryCode.toUpperCase();
    return this.item('store', key, {
      name: store?.name || key,
      country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
      region: store?.address?.region || undefined,
      city: store?.address?.city || undefined,
    });
  }

  // ---- carts and orders ----------------------------------------------------------------------------------------------

  private cartSnapshot(cart: Cart): Record<string, unknown> {
    return {
      cartId: cart.identifier.key,
      cartItemCount: cart.items.length,
      cartValue: cart.price.grandTotal.value,
      cartValueEur: this.eur(cart.price.grandTotal),
    };
  }

  private cartTarget(cart: Cart): UnomiItemPayload {
    return this.item('cart', cart.identifier.key, {
      itemCount: cart.items.length,
      value: cart.price.grandTotal.value,
      valueEur: this.eur(cart.price.grandTotal),
      currency: cart.price.grandTotal.currency,
    });
  }

  /** The postal code cut to the configured number of characters of the country. A country without one sends no area. */
  private postalArea(country: string, postalCode: string): string | undefined {
    const code = postalCode.replace(/\s+/g, '');
    const digits = this.config.shippingPostalAreaDigits[country];
    return digits && code.length > 0 ? code.slice(0, digits) : undefined;
  }

  private async orderTarget(payload: Parameters<typeof summarizePlacedOrder>[0]): Promise<UnomiItemPayload | undefined> {
    const placed = summarizePlacedOrder(payload);
    if (!placed) {
      return undefined;
    }
    // A large order must not fire all its product and category lookups at once.
    const built = await mapLimit(placed.items, LINE_CONCURRENCY, async (item) => {
      const resolved = await this.resolveVariant(item.variant);
      return { key: resolved.key, line: await this.lineProperties(resolved.key, resolved.product, item.variant.sku, item.quantity, item.price.unitPrice) };
    });
    const lines = built.map((b) => b.line);
    const flat = (name: string): string[] => unique(lines.flatMap((l) => (Array.isArray(l[name]) ? (l[name] as string[]) : [])));

    const source = payload.checkout ?? payload.order;
    const address = source?.shippingAddress;
    const country = address?.countryCode.toUpperCase();
    const validCountry = country && /^[A-Z]{2}$/.test(country) ? country : undefined;

    return this.item('order', placed.transactionId, {
      itemCount: placed.items.length,
      total: placed.price.grandTotal.value,
      totalEur: this.eur(placed.price.grandTotal),
      currency: placed.price.grandTotal.currency,
      lines,
      productIds: unique(built.map((b) => b.key)),
      categoryIds: flat('categoryIds'),
      brands: unique(lines.flatMap((l) => (typeof l['brand'] === 'string' ? [l['brand']] : []))),
      conceptIds: flat('conceptIds'),
      // The checkout does not carry the coupon codes, only the cart does.
      couponCodes: [],
      deliveryMethod: payload.checkout?.shippingInstruction?.shippingMethod.key,
      shippingCountry: validCountry,
      shippingPostalArea: validCountry && address ? this.postalArea(validCountry, address.postalCode) : undefined,
    });
  }
}
