import * as z from 'zod';
import { AmountSchema, EventCommonPropertiesSchema } from './common.js';
import type { ItemName } from './items.js';

export interface EventDefinition {
  /** Unomi event type, lowerCamelCase and past tense. */
  readonly name: string;
  /** The reactionary analytics event type this is sent for. */
  readonly analyticsType: string;
  readonly title: string;
  readonly description: string;
  /** The item the event is about. Events without one send no `target`. */
  readonly target?: ItemName;
  /** The `properties` of the event, always including the common ones. */
  readonly properties: z.ZodObject;
  /** A valid sample, used for tests and for the example events in the CDP repository. */
  readonly example: {
    readonly target?: { readonly itemId: string; readonly properties: Record<string, unknown> };
    readonly properties: Record<string, unknown>;
  };
}

const common = EventCommonPropertiesSchema;

/** The cart after a line was added or removed. */
const CartSnapshotSchema = z.object({
  cartId: z.string(),
  cartItemCount: z.int().min(0),
  cartValue: AmountSchema.meta({ description: 'Total of the cart after the change, in `currency`.' }),
  cartValueEur: AmountSchema.optional(),
});

const exampleCommon = { locale: 'da-DK', currency: 'DKK', device: 'desktop', fxRate: 0.134, fxDate: '2026-10-29T00:00:00.000Z' };

const exampleProduct = {
  name: 'Cordless drill 18V',
  brand: 'Bosch',
  productType: 'cordless-drills',
  categoryIds: ['power-tools', 'drilling-fastening'],
  conceptIds: ['application/power-tools', 'application/drilling-fastening', 'features/cordless'],
  price: 1499,
  priceEur: 200.87,
  currency: 'DKK',
  onSale: false,
};

const exampleLine = { ...exampleProduct, sku: 'GSR18-2', quantity: 1, unitPrice: 1499, unitPriceEur: 200.87 };

const exampleCart = { itemCount: 2, value: 1798, valueEur: 240.93, currency: 'DKK' };

const exampleOrder = {
  itemCount: 1,
  total: 1499,
  totalEur: 200.87,
  currency: 'DKK',
  lines: [exampleLine],
  productIds: ['prod_01J9X'],
  categoryIds: ['power-tools', 'drilling-fastening'],
  brands: ['Bosch'],
  conceptIds: exampleProduct.conceptIds,
  couponCodes: [],
  deliveryMethod: 'home',
  shippingCountry: 'DK',
  shippingPostalArea: '8000',
};

const product = { itemId: 'prod_01J9X', properties: exampleProduct };
const line = { itemId: 'prod_01J9X', properties: exampleLine };
const cart = { itemId: 'cart_01J9Y', properties: exampleCart };
const order = { itemId: 'order_01J9Z', properties: exampleOrder };

const cartSnapshot = { cartId: 'cart_01J9Y', cartItemCount: 2, cartValue: 1798, cartValueEur: 240.93 };

export const eventDefinitions = [
  {
    name: 'productViewed',
    analyticsType: 'product-viewed',
    title: 'ProductViewed',
    description: 'The visitor looked at a product detail page.',
    target: 'product',
    properties: common,
    example: { target: product, properties: { ...exampleCommon, origin: { type: 'search', term: 'drill' } } },
  },
  {
    name: 'productClicked',
    analyticsType: 'product-clicked',
    title: 'ProductClicked',
    description: 'The visitor clicked a product in a list. A small bonus on top of the view that usually follows.',
    target: 'product',
    properties: common,
    example: { target: product, properties: { ...exampleCommon, origin: { type: 'category', categoryId: 'power-tools' } } },
  },
  {
    name: 'categoryViewed',
    analyticsType: 'category-viewed',
    title: 'CategoryViewed',
    description: 'The visitor opened a category listing.',
    target: 'category',
    properties: common,
    example: { target: { itemId: 'drilling-fastening', properties: { name: 'Drilling and fastening', categoryIds: ['power-tools', 'drilling-fastening'] } }, properties: exampleCommon },
  },
  {
    name: 'contentViewed',
    analyticsType: 'content-viewed',
    title: 'ContentViewed',
    description: 'The visitor read a CMS article or page. Its concepts count as interest like those of a product.',
    target: 'content',
    properties: common,
    example: { target: { itemId: 'article_cordless-guide', properties: { contentType: 'article', conceptIds: ['features/cordless'] } }, properties: exampleCommon },
  },
  {
    name: 'promotionClicked',
    analyticsType: 'promotion-clicked',
    title: 'PromotionClicked',
    description: 'The visitor clicked a promotion. Shows responsiveness to deals.',
    target: 'promotion',
    properties: common,
    example: { target: { itemId: 'promo_autumn', properties: { name: 'Autumn sale', slot: 'hero' } }, properties: exampleCommon },
  },
  {
    name: 'cartItemAdded',
    analyticsType: 'cart-item-added',
    title: 'CartItemAdded',
    description: 'The visitor put a product in the cart. Strong intent.',
    target: 'line',
    properties: common.extend(CartSnapshotSchema.shape),
    example: { target: line, properties: { ...exampleCommon, ...cartSnapshot } },
  },
  {
    name: 'cartItemRemoved',
    analyticsType: 'cart-item-removed',
    title: 'CartItemRemoved',
    description: 'The visitor took a product out of the cart.',
    target: 'line',
    properties: common.extend(CartSnapshotSchema.shape),
    example: { target: line, properties: { ...exampleCommon, ...cartSnapshot } },
  },
  {
    name: 'couponApplied',
    analyticsType: 'coupon-applied',
    title: 'CouponApplied',
    description: 'The visitor used a coupon code. Shows deal seeking.',
    target: 'cart',
    properties: common.extend({ code: z.string() }),
    example: { target: cart, properties: { ...exampleCommon, code: 'AUTUMN10' } },
  },
  {
    name: 'checkoutStarted',
    analyticsType: 'checkout-started',
    title: 'CheckoutStarted',
    description: 'The visitor entered checkout. With the cart events this shows abandonment.',
    target: 'cart',
    properties: common,
    example: { target: cart, properties: exampleCommon },
  },
  {
    name: 'orderPlaced',
    analyticsType: 'order-placed',
    title: 'OrderPlaced',
    description: 'The visitor placed an order. The strongest interest signal, and the source of order count and last order date.',
    target: 'order',
    properties: common,
    example: { target: order, properties: exampleCommon },
  },
  {
    name: 'quoteRequested',
    analyticsType: 'quote-requested',
    title: 'QuoteRequested',
    description: 'A B2B buyer asked for a quote on the cart.',
    target: 'cart',
    properties: common,
    example: { target: cart, properties: exampleCommon },
  },
  {
    name: 'orderReordered',
    analyticsType: 'order-reordered',
    title: 'OrderReordered',
    description: 'The visitor reordered the items of an earlier order. Replenishment behaviour.',
    target: 'order',
    properties: common,
    example: { target: order, properties: exampleCommon },
  },
  {
    name: 'wishlistItemAdded',
    analyticsType: 'wishlist-item-added',
    title: 'WishlistItemAdded',
    description: 'The visitor saved a product to a list. Intent without purchase.',
    target: 'product',
    properties: common,
    example: { target: product, properties: exampleCommon },
  },
  {
    name: 'backInStockRequested',
    analyticsType: 'back-in-stock-requested',
    title: 'BackInStockRequested',
    description: 'The visitor asked to be told when a product is available again.',
    target: 'product',
    properties: common,
    example: { target: product, properties: exampleCommon },
  },
  {
    name: 'storeSelected',
    analyticsType: 'store-selected',
    title: 'StoreSelected',
    description: 'The visitor chose a store. A hint of the area they shop in, not of where they live.',
    target: 'store',
    properties: common,
    example: { target: { itemId: 'store_aarhus', properties: { name: 'Aarhus', country: 'DK', region: 'Midtjylland', city: 'Aarhus' } }, properties: exampleCommon },
  },
  {
    name: 'reviewSubmitted',
    analyticsType: 'review-submitted',
    title: 'ReviewSubmitted',
    description: 'The visitor reviewed a product. The rating only, never the text.',
    target: 'product',
    properties: common.extend({ rating: z.number().min(0) }),
    example: { target: product, properties: { ...exampleCommon, rating: 4 } },
  },
  {
    name: 'productShared',
    analyticsType: 'product-shared',
    title: 'ProductShared',
    description: 'The visitor shared a product.',
    target: 'product',
    properties: common.extend({ channel: z.string().optional() }),
    example: { target: product, properties: { ...exampleCommon, channel: 'email' } },
  },
  {
    name: 'newsletterSubscribed',
    analyticsType: 'newsletter-subscribed',
    title: 'NewsletterSubscribed',
    description: 'The visitor subscribed to a newsletter.',
    properties: common.extend({ channel: z.string().optional() }),
    example: { properties: { ...exampleCommon, channel: 'email' } },
  },
  {
    name: 'userRegistered',
    analyticsType: 'user-registered',
    title: 'UserRegistered',
    description: 'The visitor created an account.',
    properties: common,
    example: { properties: exampleCommon },
  },
  {
    name: 'companyRegistered',
    analyticsType: 'company-registered',
    title: 'CompanyRegistered',
    description: 'A company account was registered (B2B).',
    properties: common,
    example: { properties: exampleCommon },
  },
  {
    name: 'experimentExposed',
    analyticsType: 'experiment-exposed',
    title: 'ExperimentExposed',
    description: 'The visitor was shown a version of an experiment, the control included. Sent once per session.',
    target: 'experiment',
    properties: common,
    example: { target: { itemId: 'exp.hero-banner.b', properties: { experimentKey: 'hero-banner', version: 'b' } }, properties: exampleCommon },
  },
  {
    name: 'traitDeclared',
    analyticsType: 'trait-declared',
    title: 'TraitDeclared',
    description: 'The visitor declared something about themselves, e.g. their trade. Stronger evidence than behaviour.',
    target: 'trait',
    properties: common,
    example: { target: { itemId: 'trade.electrician', properties: { trait: 'trade', value: 'electrician' } }, properties: exampleCommon },
  },
] as const satisfies readonly EventDefinition[];

export type EventName = (typeof eventDefinitions)[number]['name'];
