import {
  CartSchema,
  CategoryCapability,
  ClientBuilder,
  CostBreakDownSchema,
  NoOpCache,
  OrderSchema,
  PriceCapability,
  ProductCapability,
  StoreCapability,
  createInitialRequestContext,
  error,
  fromPDP,
  fromSearch,
  success,
} from '@reactionary/core';
import type { Category, Price, Product, Result, SearchIdentifier, Store } from '@reactionary/core';
import { Ajv2019, type ValidateFunction } from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { hash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnomiAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { SCHEMA_BASE_URL, generateSchemas } from '../contract/index.js';
import { clearFxCache } from '../core/fx.js';
import { UnomiConfigurationSchema } from '../schema/configuration.schema.js';
import { unomiBaseSchemas } from './fixtures/unomi-base-schemas.js';

const fetchMock = vi.fn<typeof fetch>();

const money = (value: number) => ({ currency: 'DKK', value });
const price = (value: number) => ({ unitPrice: money(value), totalDiscount: money(0), totalPrice: money(value), unitDiscount: money(0) });

const drill = {
  identifier: { key: 'p1' },
  name: 'Cordless drill 18V',
  brand: 'Bosch',
  parentCategories: [{ key: 'drilling' }],
  productType: { identifier: { key: 'cordless-drills' }, name: 'Cordless drills' },
  concepts: [
    { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' },
    { identifier: { key: 'application/power-tools' }, vocabulary: 'application', name: 'Power tools' },
  ],
  mainVariant: { identifier: { sku: 'SKU-1' } },
} as unknown as Product;

const saw = {
  identifier: { key: 'p2' },
  name: 'Saw',
  brand: '',
  parentCategories: [],
  concepts: [{ identifier: { key: 'application/power-tools' }, vocabulary: 'application', name: 'Power tools' }],
  mainVariant: { identifier: { sku: 'SKU-2' } },
} as unknown as Product;

const products: Record<string, Product> = { p1: drill, p2: saw, 'a/b': { ...drill, identifier: { key: 'a/b' }, name: 'Odd key' } as Product };
const bySku: Record<string, Product> = { 'SKU-1': drill, 'SKU-2': saw };

class StubProductCapability extends ProductCapability {
  public override async getById(payload: { identifier: { key: string } }): Promise<Result<Product>> {
    const found = products[payload.identifier.key];
    return found ? success(found) : error({ type: 'NotFound', identifier: payload.identifier.key });
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(payload: { variant: { sku: string } }): Promise<Result<Product>> {
    const found = bySku[payload.variant.sku];
    return found ? success(found) : error({ type: 'NotFound', identifier: payload.variant.sku });
  }
}

const power = { identifier: { key: 'power-tools' }, name: 'Power tools' } as unknown as Category;
const drilling = { identifier: { key: 'drilling' }, name: 'Drilling', parentCategory: { key: 'power-tools' } } as unknown as Category;

class StubCategoryCapability extends CategoryCapability {
  public override async getById(payload: { id: { key: string } }): Promise<Result<Category, never>> {
    return success(payload.id.key === 'drilling' ? drilling : power) as Result<Category, never>;
  }
  public override async getBreadcrumbPathToCategory(): Promise<Result<Category[]>> {
    // leaf first on purpose: the provider has to put the root first
    return success([drilling, power]);
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async findChildCategories(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async findTopCategories(): Promise<never> {
    throw new Error('not implemented');
  }
}

class StubPriceCapability extends PriceCapability {
  public override async getListPrice(): Promise<Result<Price>> {
    return error({ type: 'NotFound', identifier: 'list' });
  }
  public override async getCustomerPrice(): Promise<Result<Price>> {
    return success({ identifier: { variant: { sku: 'SKU-1' } }, unitPrice: money(1499), onSale: true, tieredPrices: [] } as unknown as Price);
  }
}

class StubStoreCapability extends StoreCapability {
  public override async getById(): Promise<Result<Store, never>> {
    return success({
      identifier: { key: 'store-aarhus' },
      name: 'Aarhus',
      address: { countryCode: 'dk', region: 'Midtjylland', city: 'Aarhus', postalCode: '8000' },
    } as unknown as Store) as Result<Store, never>;
  }
  public override async queryByProximity(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async list(): Promise<never> {
    throw new Error('not implemented');
  }
}

const search: SearchIdentifier = { term: 'cable', facets: [{ facet: { key: 'brand' }, key: 'bosch' }], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };

type Posted = {
  source: Record<string, unknown>;
  profileId: string;
  sessionId?: string;
  events: Array<{
    eventType: string;
    scope: string;
    itemId: string;
    timeStamp: string;
    source: Record<string, unknown>;
    target?: { itemType: string; itemId: string; scope: string; properties: Record<string, any> };
    properties?: Record<string, any>;
  }>;
};

const ECB_XML = `<?xml version="1.0"?><gesmes:Envelope><Cube><Cube time='2026-10-28'><Cube currency='USD' rate='1.1600'/><Cube currency='DKK' rate='7.4600'/></Cube></Cube></gesmes:Envelope>`;

describe('Unomi Analytics Capability', () => {
  let context: ReturnType<typeof createInitialRequestContext>;

  const config = UnomiConfigurationSchema.parse({
    apiUrl: 'https://unomi.example.invalid',
    scope: 'test-scope',
    username: 'tenant-1',
    password: 'private-key',
    fxRatesUrl: '',
  });

  const buildClient = (override: Record<string, unknown> = {}, product: ProductCapability = new StubProductCapability(new NoOpCache(), context)) =>
    new ClientBuilder(context)
      .withCache(new NoOpCache())
      .withCapability(() => ({ analytics: new UnomiAnalyticsCapability(new NoOpCache(), context, { ...config, ...override }) }))
      .withCapability(() => ({ product }))
      .withCapability(() => ({ category: new StubCategoryCapability(new NoOpCache(), context) }))
      .withCapability(() => ({ price: new StubPriceCapability(new NoOpCache(), context) }))
      .withCapability(() => ({ store: new StubStoreCapability(new NoOpCache(), context) }))
      .build();

  /** The request bodies posted to Unomi so far (not the ECB rates). */
  const posts = (): Posted[] =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes('context.json')).map(([, init]) => JSON.parse(String(init?.body)) as Posted);
  const events = () => posts().flatMap((p) => p.events);

  const cart = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [{ identifier: { key: 'l1' }, product: { key: 'p1' }, variant: { sku: 'SKU-1' }, quantity: 3, price: price(1499) }],
      price: { ...CostBreakDownSchema.parse({}), grandTotal: money(4497) },
    });

  const order = (address?: { postalCode: string; countryCode: string }) =>
    OrderSchema.parse({
      identifier: { key: 'order-1' },
      userId: { userId: 'user-1' },
      items: ['SKU-1', 'SKU-2'].map((sku, i) => ({
        identifier: { key: `line-${i}` },
        inventoryStatus: 'Allocated',
        price: price(100 * (i + 1)),
        quantity: i + 1,
        variant: { sku },
      })),
      price: { ...CostBreakDownSchema.parse({}), grandTotal: money(500) },
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'Allocated',
      paymentInstructions: [],
      ...(address ? { shippingAddress: { identifier: { nickName: 'home' }, firstName: '', lastName: '', streetAddress: 'Main street', streetNumber: '1', city: 'Town', region: '', ...address } } : {}),
    });

  // The JSON schemas of the contract with the Unomi base schemas, the way Unomi validates.
  const ajv = new Ajv2019({ strict: false, allErrors: true });
  addFormats.default(ajv);
  unomiBaseSchemas.forEach((s) => ajv.addSchema(s));
  generateSchemas().forEach((f) => ajv.addSchema(f.document));
  const validatorOf = (eventType: string): ValidateFunction | undefined => ajv.getSchema(`${SCHEMA_BASE_URL}/events/${eventType}/1-0-0`);

  beforeEach(() => {
    clearFxCache();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url) => new Response(String(url).includes('eurofxref') ? ECB_XML : '{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    context = createInitialRequestContext();
    context.session.marketingContext.identifier.key = 'profile-1';
    context.session.id = 'session-1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to the context endpoint as a trusted caller, with the profile, the session and the source', async () => {
    const client = buildClient();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://unomi.example.invalid/cxs/context.json',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authorization: `Basic ${btoa('tenant-1:private-key')}` }) }),
    );
    const [post] = posts();
    expect(post).toMatchObject({
      source: { itemType: 'site', scope: 'test-scope', itemId: 'reactionary' },
      profileId: 'profile-1',
      sessionId: 'session-1',
    });
    expect(post.events).toHaveLength(1);
    expect(post.events[0]).toMatchObject({
      eventType: 'productViewed',
      scope: 'test-scope',
      source: { itemType: 'site', itemId: 'reactionary', scope: 'test-scope' },
    });
    expect(post.events[0].itemId).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.events[0].timeStamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sends the peer key and the api key as headers when they are configured', async () => {
    const client = buildClient({ peerKey: 'peer-secret', username: undefined, password: undefined, apiKey: 'public-key' });

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['x-unomi-peer']).toBe('peer-secret');
    expect(headers['x-unomi-api-key']).toBe('public-key');
  });

  describe('products', () => {
    it('sends the product with its categories root first, concepts, brand, type and price in two currencies', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' }, origin: fromPDP(fromSearch(search, 4)) });
      await client.analytics.flush();

      const [event] = events();
      expect(event.target).toEqual({
        itemType: 'product',
        itemId: 'p1',
        scope: 'test-scope',
        properties: {
          name: 'Cordless drill 18V',
          brand: 'Bosch',
          productType: 'cordless-drills',
          categoryIds: ['power-tools', 'drilling'],
          conceptIds: ['features/cordless', 'application/power-tools'],
          price: 1499,
          priceEur: 200.87,
          currency: 'DKK',
          onSale: true,
        },
      });
      expect(event.properties).toMatchObject({ locale: 'da-DK', currency: 'DKK', fxRate: 0.134, origin: { type: 'search', term: 'cable', filters: ['brand:bosch'] } });
      expect(event.properties?.['fxDate']).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
      expect(event.properties).not.toHaveProperty('origin.position');
    });

    it('leaves out the brand when the product has none', async () => {
      const client = buildClient();

      await client.analytics.productClicked({ product: { key: 'p2' } });
      await client.analytics.flush();

      expect(events()[0].target?.properties).not.toHaveProperty('brand');
      expect(events()[0].eventType).toBe('productClicked');
    });

    it('sends fewer fields, not no event, when a lookup fails', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'missing' } });
      await client.analytics.flush();

      expect(events()[0].target).toMatchObject({ itemId: 'missing', properties: { name: 'missing', categoryIds: [], conceptIds: [] } });
    });

    it('replaces a key Unomi would not accept by a stable hash and keeps the readable name', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'a/b' } });
      await client.analytics.flush();

      expect(events()[0].target?.itemId).toMatch(/^h-[0-9a-f]{40}$/);
      expect(events()[0].target?.properties['name']).toBe('Odd key');
    });

    it('resolves the product of a variant for a wishlist and a back in stock request', async () => {
      const client = buildClient();

      await client.analytics.wishlistItemAdded({ list: { listType: 'wish', key: 'w1' }, variant: { sku: 'SKU-1' } });
      await client.analytics.backInStockRequested({ variant: { sku: 'SKU-2' } });
      await client.analytics.flush();

      expect(events().map((e) => [e.eventType, e.target?.itemId])).toEqual([['wishlistItemAdded', 'p1'], ['backInStockRequested', 'p2']]);
    });

    it('sends a review as the rating only and a share with its channel', async () => {
      const client = buildClient();

      await client.analytics.reviewSubmitted({ product: { key: 'p1' }, rating: 4 });
      await client.analytics.productShared({ product: { key: 'p1' }, channel: 'email' });
      await client.analytics.flush();

      expect(events()[0].properties).toMatchObject({ rating: 4 });
      expect(events()[1].properties).toMatchObject({ channel: 'email' });
    });

    it('takes the origin of a product page visit from the list that led there', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' }, origin: fromPDP({ type: 'promotion', promotionId: { key: 'autumn' }, slot: 'hero' }) });
      await client.analytics.flush();

      expect(events()[0].properties?.['origin']).toEqual({ type: 'promotion', promotionId: 'autumn', slot: 'hero' });
    });
  });

  describe('categories, content, promotions and stores', () => {
    it('sends a category with its path, root first', async () => {
      const client = buildClient();

      await client.analytics.categoryViewed({ category: { key: 'drilling' } });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'categoryViewed', target: { itemType: 'category', itemId: 'drilling', properties: { name: 'Drilling', categoryIds: ['power-tools', 'drilling'] } } });
    });

    it('sends the concepts of content as the caller gave them, once each', async () => {
      const client = buildClient();

      await client.analytics.contentViewed({ content: { key: 'article-1', type: 'article' }, concepts: ['features/cordless', 'features/cordless'] });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'contentViewed', target: { itemId: 'article-1', properties: { contentType: 'article', conceptIds: ['features/cordless'] } } });
    });

    it('sends a promotion click with its slot', async () => {
      const client = buildClient();

      await client.analytics.promotionClicked({ promotion: { id: 'autumn', name: 'Autumn sale', slot: 'hero' } });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'promotionClicked', target: { itemId: 'autumn', properties: { name: 'Autumn sale', slot: 'hero' } } });
    });

    it('sends a store with its region and no coordinates', async () => {
      const client = buildClient();

      await client.analytics.storeSelected({ store: { key: 'store-aarhus' } });
      await client.analytics.flush();

      expect(events()[0].target).toMatchObject({ itemType: 'store', itemId: 'store-aarhus', properties: { name: 'Aarhus', country: 'DK', region: 'Midtjylland', city: 'Aarhus' } });
    });
  });

  describe('carts and orders', () => {
    it('sends a cart add as a line with the unit price of the cart and the cart after the change', async () => {
      const client = buildClient();

      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 3 });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({
        eventType: 'cartItemAdded',
        target: { itemType: 'line', itemId: 'p1', properties: { sku: 'SKU-1', quantity: 3, unitPrice: 1499, unitPriceEur: 200.87, price: 1499 } },
        properties: { cartId: 'cart-1', cartItemCount: 1, cartValue: 4497, cartValueEur: 602.6 },
      });
    });

    it('sends a cart removal for a line or just a variant', async () => {
      const client = buildClient();

      await client.analytics.cartItemRemoved({ cart: cart(), removed: { sku: 'SKU-1' }, quantity: 1 });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'cartItemRemoved', target: { itemType: 'line', properties: { sku: 'SKU-1', quantity: 1 } } });
    });

    it('sends a coupon, a checkout and a quote request on the cart', async () => {
      const client = buildClient();

      await client.analytics.couponApplied({ cart: cart(), code: 'AUTUMN10' });
      await client.analytics.checkoutStarted({ cart: cart() });
      await client.analytics.quoteRequested({ cart: cart() });
      await client.analytics.flush();

      expect(events().map((e) => e.eventType)).toEqual(['couponApplied', 'checkoutStarted', 'quoteRequested']);
      expect(events()[0].properties).toMatchObject({ code: 'AUTUMN10' });
      expect(events()[1].target).toMatchObject({ itemType: 'cart', itemId: 'cart-1', properties: { itemCount: 1, value: 4497, valueEur: 602.6, currency: 'DKK' } });
    });

    it('sends an order with its lines and the flat arrays Unomi can match on', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({ order: order() });
      await client.analytics.flush();

      const target = events()[0].target;
      expect(events()[0].eventType).toBe('orderPlaced');
      expect(target).toMatchObject({
        itemType: 'order',
        itemId: 'order-1',
        properties: {
          itemCount: 2,
          total: 500,
          totalEur: 67,
          currency: 'DKK',
          productIds: ['p1', 'p2'],
          categoryIds: ['power-tools', 'drilling'],
          brands: ['Bosch'],
          conceptIds: ['features/cordless', 'application/power-tools'],
          couponCodes: [],
        },
      });
      expect(target?.properties['lines']).toHaveLength(2);
      expect(target?.properties['lines'][1]).toMatchObject({ sku: 'SKU-2', quantity: 2, unitPrice: 200 });
    });

    it('cuts the shipping postal code to an area per country and never sends the street', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({ order: order({ postalCode: '111 22', countryCode: 'se' }) });
      await client.analytics.orderPlaced({ order: order({ postalCode: '8000', countryCode: 'dk' }) });
      await client.analytics.flush();

      expect(events()[0].target?.properties).toMatchObject({ shippingCountry: 'SE', shippingPostalArea: '111' });
      expect(events()[1].target?.properties).toMatchObject({ shippingCountry: 'DK', shippingPostalArea: '8000' });
      expect(JSON.stringify(events())).not.toContain('Main street');
    });

    it('sends only the country, no postal area, for a country with no configured cut', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({ order: order({ postalCode: 'SW1A 1AA', countryCode: 'gb' }) });
      await client.analytics.flush();

      expect(events()[0].target?.properties).toMatchObject({ shippingCountry: 'GB' });
      expect(events()[0].target?.properties).not.toHaveProperty('shippingPostalArea');
      expect(JSON.stringify(events())).not.toContain('SW1A');
    });

    it('looks the products of a large order up a few at a time', async () => {
      class CountingProductCapability extends StubProductCapability {
        public active = 0;
        public peak = 0;
        public override async getBySKU(payload: { variant: { sku: string } }): Promise<Result<Product>> {
          this.active++;
          this.peak = Math.max(this.peak, this.active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          this.active--;
          return super.getBySKU(payload);
        }
      }
      const counting = new CountingProductCapability(new NoOpCache(), context);
      const client = buildClient({}, counting);
      const big = OrderSchema.parse({
        identifier: { key: 'order-big' },
        userId: { userId: 'user-1' },
        items: Array.from({ length: 12 }, (_, i) => ({
          identifier: { key: `line-${i}` },
          inventoryStatus: 'Allocated',
          price: price(10),
          quantity: 1,
          variant: { sku: `S${i}` },
        })),
        price: { ...CostBreakDownSchema.parse({}), grandTotal: money(120) },
        orderStatus: 'AwaitingPayment',
        inventoryStatus: 'Allocated',
        paymentInstructions: [],
      });

      await client.analytics.orderPlaced({ order: big });
      await client.analytics.flush();

      expect(events()[0].target?.properties['lines']).toHaveLength(12);
      expect(counting.peak).toBeGreaterThan(1);
      expect(counting.peak).toBeLessThanOrEqual(5);
    });

    it('sends nothing when the order has no checkout and no order', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({});
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends a reorder as the order it was made from', async () => {
      const client = buildClient();

      await client.analytics.orderReordered({ order: order(), cart: cart() });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'orderReordered', target: { itemType: 'order', itemId: 'order-1' } });
    });
  });

  describe('experiments and traits', () => {
    it('sends an experiment exposure with the version as the item id', async () => {
      const client = buildClient();

      await client.analytics.experimentExposed({ experimentKey: 'hero-banner', version: 'b' });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({
        eventType: 'experimentExposed',
        target: { itemType: 'experiment', itemId: 'exp.hero-banner.b', properties: { experimentKey: 'hero-banner', version: 'b' } },
      });
    });

    it('leaves out, with a warning, an exposure that does not match the contract', async () => {
      const client = buildClient();

      await client.analytics.experimentExposed({ experimentKey: 'Hero Banner', version: 'B' });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('experimentExposed left out'));
      expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).not.toContain('Hero Banner');
    });

    it('sends a declared trait with <trait>.<value> as the item id', async () => {
      const client = buildClient();

      await client.analytics.traitDeclared({ trait: 'trade', value: 'electrician' });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({ eventType: 'traitDeclared', target: { itemType: 'trait', itemId: 'trade.electrician', properties: { trait: 'trade', value: 'electrician' } } });
    });
  });

  describe('lifecycle and built-in events', () => {
    it('sends newsletter, registration and company events without a target', async () => {
      const client = buildClient();

      await client.analytics.newsletterSubscribed({ channel: 'email' });
      await client.analytics.userRegistered({ identity: { type: 'Registered', id: { userId: 'user-1' } } });
      await client.analytics.flush();

      expect(events().map((e) => [e.eventType, e.target])).toEqual([['newsletterSubscribed', undefined], ['userRegistered', undefined]]);
    });

    it('sends a page view as the built-in view with a page target and no other properties', async () => {
      const client = buildClient();

      context.referrer = 'https://search.example/results?q=john@example.com';
      await client.analytics.pageViewed({ page: { type: 'content', url: 'https://shop.example/campaign/springtime?token=abc#top', title: 'Springtime' } });
      await client.analytics.flush();

      expect(events()[0]).toMatchObject({
        eventType: 'view',
        target: { itemType: 'page', properties: { pageInfo: { pagePath: '/campaign/springtime', pageName: 'Springtime', destinationURL: 'https://shop.example/campaign/springtime', language: 'da-DK' } } },
      });
      expect(events()[0]).not.toHaveProperty('properties');
    });

    it('never sends a query string or a fragment of a page or its referrer', async () => {
      context.referrer = 'https://search.example/results?q=john@example.com';
      const client = buildClient();

      await client.analytics.pageViewed({ page: { type: 'search', url: '/search?q=secret#frag', title: 'Search' } });
      await client.analytics.flush();

      const sent = JSON.stringify(events());
      expect(sent).not.toContain('secret');
      expect(sent).not.toContain('john@example.com');
      expect(sent).not.toContain('frag');
    });

    it('sends a login on the profile the visitor had before it, with a hashed user id', async () => {
      const client = buildClient();

      await client.analytics.userLoggedIn({ identity: { type: 'Registered', id: { userId: 'user-1' } }, previousMarketingId: { key: 'anonymous-profile' } });
      await client.analytics.flush();

      expect(posts()[0].profileId).toBe('anonymous-profile');
      expect(events()[0]).toMatchObject({ eventType: 'login', properties: { userId: hash('sha256', 'user-1') } });
      expect(events()[0]).not.toHaveProperty('target');
    });

    it('sends no login for an anonymous identity', async () => {
      const client = buildClient();

      await client.analytics.userLoggedIn({ identity: { type: 'Anonymous' } });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('what is not sent', () => {
    it('sends nothing for impressions and steps the contract leaves out', async () => {
      const client = buildClient();

      await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }, { key: 'p2' }] });
      await client.analytics.productCarouselViewed({ carousel: { carouselName: 'x' }, products: [{ key: 'p1' }] });
      await client.analytics.cartViewed({ cart: cart() });
      await client.analytics.custom({ name: 'anything', payload: {} });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends nothing for a bot', async () => {
      context.isBot = true;
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends nothing for a visitor without a marketing profile', async () => {
      context.session.marketingContext.identifier.key = '';
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('device, session and money', () => {
    it.each([
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', 'mobile'],
      ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'tablet'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', 'desktop'],
    ])('classifies %s as %s and never sends the user agent', async (userAgent, device) => {
      context.userAgent = userAgent;
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(events()[0].properties?.['device']).toBe(device);
      expect(JSON.stringify(posts())).not.toContain('Mozilla');
    });

    it('sends no device without a user agent and no session id without a session', async () => {
      context.session.id = '';
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(events()[0].properties).not.toHaveProperty('device');
      expect(posts()[0]).not.toHaveProperty('sessionId');
    });

    it('replaces a session id Unomi would not accept by a stable hash', async () => {
      context.session.id = 'a session/with odd characters';
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(posts()[0].sessionId).toMatch(/^h-[0-9a-f]{40}$/);
    });

    it('uses the ECB rate of the latest day, once a day, and fixes it on the event', async () => {
      const client = buildClient({ fxRatesUrl: 'https://ecb.example.invalid/eurofxref-daily.xml' });

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(events()[0].properties).toMatchObject({ fxRate: 0.13404826, fxDate: '2026-10-28T00:00:00.000Z' });
      expect(events()[0].target?.properties['priceEur']).toBe(200.94);
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('eurofxref'))).toHaveLength(1);
    });

    it('does not fetch the exchange rates for an event that carries no amount', async () => {
      const client = buildClient({ fxRatesUrl: 'https://ecb.example.invalid/eurofxref-daily.xml' });

      await client.analytics.storeSelected({ store: { key: 'store-aarhus' } });
      await client.analytics.traitDeclared({ trait: 'trade', value: 'electrician' });
      await client.analytics.flush();

      expect(events()).toHaveLength(2);
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('eurofxref'))).toHaveLength(0);
    });

    it('keeps the rate of a currency worth a tiny fraction of a euro to eight significant digits', async () => {
      fetchMock.mockImplementation(async (url) => new Response(String(url).includes('eurofxref') ? ECB_XML.replace("currency='USD' rate='1.1600'", "currency='USD' rate='17000'") : '{}'));
      context.languageContext.currencyCode = 'USD';
      const client = buildClient({ fxRatesUrl: 'https://ecb.example.invalid/eurofxref-daily.xml' });

      await client.analytics.checkoutStarted({ cart: CartSchema.parse({ identifier: { key: 'c' }, user: { userId: 'user-1' }, price: { ...CostBreakDownSchema.parse({}), grandTotal: { currency: 'USD', value: 1000000 } } }) });
      await client.analytics.flush();

      expect(events()[0].properties?.['fxRate']).toBe(0.000058823529);
      expect(events()[0].target?.properties['valueEur']).toBe(58.82);
    });

    it('falls back to the configured rate when the ECB cannot be reached, and sends no EUR amount without any rate', async () => {
      fetchMock.mockImplementation(async (url) => (String(url).includes('eurofxref') ? new Response('nope', { status: 503 }) : new Response('{}')));
      const client = buildClient({ fxRatesUrl: 'https://ecb.example.invalid/eurofxref-daily.xml' });

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();
      expect(events()[0].properties).toMatchObject({ fxRate: 0.134 });

      clearFxCache();
      fetchMock.mockClear();
      const noRate = buildClient({ fxRatesUrl: '', fxFallbackRates: {} });
      await noRate.analytics.productViewed({ product: { key: 'p1' } });
      await noRate.analytics.flush();
      expect(events()[0].properties).not.toHaveProperty('fxRate');
      expect(events()[0].target?.properties).not.toHaveProperty('priceEur');
    });
  });

  it('fails the delivery, for the dispatcher to report, when Unomi answers with an error', async () => {
    fetchMock.mockImplementation(async () => new Response('no', { status: 500 }));
    const client = buildClient();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(client.analytics.productViewed({ product: { key: 'p1' } })).resolves.toMatchObject({ success: true });
    await client.analytics.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('against the JSON schemas of the contract', () => {
    it('produces events that the generated schemas accept, one of every kind', async () => {
      const client = buildClient();
      const a = client.analytics;

      await a.productViewed({ product: { key: 'p1' }, origin: fromPDP(fromSearch(search, 2)) });
      await a.productClicked({ product: { key: 'p2' } });
      await a.categoryViewed({ category: { key: 'drilling' } });
      await a.contentViewed({ content: { key: 'article-1', type: 'article' }, concepts: ['features/cordless'] });
      await a.promotionClicked({ promotion: { id: 'autumn', name: 'Autumn', slot: 'hero' } });
      await a.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
      await a.cartItemRemoved({ cart: cart(), removed: { sku: 'SKU-1' } });
      await a.couponApplied({ cart: cart(), code: 'X' });
      await a.checkoutStarted({ cart: cart() });
      await a.orderPlaced({ order: order({ postalCode: '8000', countryCode: 'dk' }) });
      await a.quoteRequested({ cart: cart() });
      await a.orderReordered({ order: order(), cart: cart() });
      await a.wishlistItemAdded({ list: { listType: 'wish', key: 'w1' }, variant: { sku: 'SKU-1' } });
      await a.backInStockRequested({ variant: { sku: 'SKU-2' } });
      await a.storeSelected({ store: { key: 'store-aarhus' } });
      await a.reviewSubmitted({ product: { key: 'p1' }, rating: 5 });
      await a.productShared({ product: { key: 'p1' } });
      await a.newsletterSubscribed({});
      await a.userRegistered({ identity: { type: 'Registered', id: { userId: 'user-1' } } });
      await a.experimentExposed({ experimentKey: 'hero-banner', version: 'a' });
      await a.traitDeclared({ trait: 'trade', value: 'electrician' });
      await a.flush();

      const sent = events();
      expect(sent).toHaveLength(21);
      for (const event of sent) {
        const validate = validatorOf(event.eventType);
        expect(validate, `a schema for ${event.eventType}`).toBeDefined();
        expect(validate?.(event), `${event.eventType}: ${JSON.stringify(validate?.errors)}`).toBe(true);
      }
    });
  });
});
