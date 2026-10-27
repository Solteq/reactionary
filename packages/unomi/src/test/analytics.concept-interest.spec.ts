import {
  CartSchema,
  ClientBuilder,
  CostBreakDownSchema,
  NoOpCache,
  OrderSchema,
  ProductCapability,
  ProductSchema,
  createInitialRequestContext,
  error,
  fromSearch,
  success,
} from '@reactionary/core';
import type { Product, ProductConcept, ProductQueryBySKU, RequestContext, Result, SearchIdentifier } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnomiAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { WarningThrottle, conceptInterestWarnings, contentInterestConcepts, normalizeConceptId, selectInterestConcepts } from '../core/concept-interest.js';
import { withUnomiCapabilities } from '../core/initialize.js';
import { UnomiConfigurationSchema } from '../schema/configuration.schema.js';

const fetchMock = vi.fn<typeof fetch>();

const price = (value: number) => ({
  unitPrice: { currency: 'EUR', value },
  totalDiscount: { currency: 'EUR', value: 0 },
  totalPrice: { currency: 'EUR', value },
  unitDiscount: { currency: 'EUR', value: 0 },
});

const concept = (id: string, parent?: string): ProductConcept => ({
  identifier: { key: id },
  vocabulary: id.split('/')[0],
  name: id.split('/')[1],
  ...(parent ? { parent: { key: parent } } : {}),
});

/** The closure over the ancestors, like Product.concepts: battery-18v is the most specific, power only an ancestor. */
const richConcepts = [
  concept('features/power'),
  concept('features/cordless', 'features/power'),
  concept('features/battery-18v', 'features/cordless'),
  concept('features/outdoor'),
  concept('brands/acme'),
];
const otherConcepts = [concept('features/power'), concept('features/cordless', 'features/power'), concept('features/garden')];

const productConcepts: Record<string, ProductConcept[] | undefined> = {
  p1: richConcepts,
  // ids as a sloppy producer or a custom product capability could return them
  dirty: [concept('Features/Cordless'), concept('features/with.dot'), concept('noslash'), concept('features/Outdoor'), concept('Features/Cordless')],
  p2: otherConcepts,
  bare: [],
  unknown: undefined,
};
const skuProducts: Record<string, string> = { 'SKU-1': 'p1', 'SKU-2': 'p2', 'SKU-3': 'p1', 'SKU-B': 'bare' };

/** BULK-n skus belong to p1 when n is even and to p2 when it is odd, for the large orders. */
function productKeyOfSku(sku: string): string {
  const bulk = /^BULK-(\d+)$/.exec(sku);
  return skuProducts[sku] ?? (bulk ? (Number(bulk[1]) % 2 === 0 ? 'p1' : 'p2') : 'missing');
}

class StubProductCapability extends ProductCapability {
  public lookups: string[] = [];
  public skuLookups: string[] = [];
  public failWith: 'throw' | 'error' | undefined;
  public throwForSkus = new Set<string>();
  public active = 0;
  public peak = 0;

  public override async getById(payload: { identifier: { key: string } }): Promise<Result<Product>> {
    const key = payload.identifier.key;
    this.lookups.push(key);
    if (this.failWith === 'throw') {
      throw new Error('product backend down');
    }
    if (this.failWith === 'error' || key === 'missing') {
      return error({ type: 'NotFound', identifier: key });
    }
    return success({ identifier: payload.identifier, name: `Name of ${key}`, concepts: productConcepts[key] } as unknown as Product);
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(payload: ProductQueryBySKU): Promise<Result<Product>> {
    const sku = payload.variant.sku;
    this.skuLookups.push(sku);
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (this.throwForSkus.has(sku)) {
        throw new Error(`lookup of ${sku} failed`);
      }
      return await this.getById({ identifier: { key: productKeyOfSku(sku) } });
    } finally {
      this.active -= 1;
    }
  }
}

const search: SearchIdentifier = { term: 'cable', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };

describe('Unomi concept interest events', () => {
  let context: RequestContext;
  let products: StubProductCapability;

  const baseConfig = {
    apiUrl: 'https://unomi.example.invalid',
    scope: 'test-scope',
    username: 'unomi-user',
    password: 'unomi-password',
  };

  const buildClient = (options: Record<string, unknown> = {}) => {
    const config = UnomiConfigurationSchema.parse({ ...baseConfig, ...options });
    return new ClientBuilder(context)
      .withCache(new NoOpCache())
      .withCapability(() => ({ analytics: new UnomiAnalyticsCapability(new NoOpCache(), context, config) }))
      .withCapability(() => ({ product: products }))
      .build();
  };

  const posts = () =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {
      events: Array<{ eventType: string; scope: string; target?: Record<string, any>; properties?: Record<string, any> }>;
    });

  const conceptEvents = (index = 0) => posts()[index].events.filter((e) => e.eventType === 'concept_interest');
  const interest = (index = 0) => conceptEvents(index).map((e) => [e.target?.['itemId'], e.properties?.['source'], e.properties?.['vocabulary']]);

  const cart = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [{ identifier: { key: 'l1' }, product: { key: 'p1' }, variant: { sku: 'SKU-1' }, quantity: 1, price: price(12.5) }],
    });

  const order = (skus: string[]) =>
    OrderSchema.parse({
      identifier: { key: 'order-1' },
      userId: { userId: 'user-1' },
      items: skus.map((sku, i) => ({ identifier: { key: `line-${i}` }, inventoryStatus: 'Allocated', price: price(10), quantity: 1, variant: { sku } })),
      price: { ...CostBreakDownSchema.parse({}), grandTotal: { currency: 'EUR', value: 50 } },
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'Allocated',
      paymentInstructions: [],
    });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    context = createInitialRequestContext();
    context.session.marketingContext.identifier.key = 'profile-1';
    products = new StubProductCapability(new NoOpCache(), context);
    conceptInterestWarnings.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('appends one concept_interest per direct concept to a product view, most specific first, in the same request', async () => {
    const client = buildClient();
    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const events = posts()[0].events;
    expect(events[0]).toEqual({ eventType: 'product_view', scope: 'test-scope', target: { itemId: 'p1', itemType: 'product' } });
    expect(events.slice(1)).toEqual([
      { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/battery-18v', itemType: 'concept' }, properties: { source: 'product_view', vocabulary: 'features', productId: 'p1' } },
      { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/outdoor', itemType: 'concept' }, properties: { source: 'product_view', vocabulary: 'features', productId: 'p1' } },
      { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'brands/acme', itemType: 'concept' }, properties: { source: 'product_view', vocabulary: 'brands', productId: 'p1' } },
    ]);
    // the broader concepts are expanded when the interest is read, not recorded
    expect(events.map((e) => e.target?.['itemId'])).not.toContain('features/power');
    expect(events.map((e) => e.target?.['itemId'])).not.toContain('features/cordless');
  });

  it('uses the concepts of a product model in the event without a lookup', async () => {
    const client = buildClient();

    await client.analytics.productViewed({
      product: ProductSchema.parse({
        identifier: { key: 'p-model' },
        name: 'Model',
        slug: 'model',
        description: '',
        longDescription: '',
        brand: '',
        manufacturer: '',
        parentCategories: [],
        published: true,
        sharedAttributes: [],
        options: [],
        mainVariant: { identifier: { sku: 'sku-model' }, name: 'Model', images: [], ean: '', gtin: '', upc: '', barcode: '', options: [] },
        concepts: [concept('features/outdoor')],
      }),
    });
    await client.analytics.flush();

    expect(products.lookups).toEqual([]);
    expect(interest()).toEqual([['features/outdoor', 'product_view', 'features']]);
  });

  it('sends product_click, add_to_cart concepts after the existing event', async () => {
    const client = buildClient();

    await client.analytics.productClicked({ product: { key: 'p2' }, origin: fromSearch(search, 3) });
    await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
    await client.analytics.flush();

    expect(posts()[0].events[0]).toMatchObject({ eventType: 'selectItem', properties: { index: 3, searchTerm: 'cable' } });
    expect(interest(0)).toEqual([
      ['features/cordless', 'product_click', 'features'],
      ['features/garden', 'product_click', 'features'],
    ]);
    expect(posts()[1].events[0]).toMatchObject({ eventType: 'addToCart' });
    expect(interest(1).map((row) => row[1])).toEqual(['add_to_cart', 'add_to_cart', 'add_to_cart']);
    expect(interest(1).map((row) => row[0])).toEqual(['features/battery-18v', 'features/outdoor', 'brands/acme']);
  });

  it('sends purchase concepts of every distinct line product once, with a total cap', async () => {
    const client = buildClient();

    await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2', 'SKU-3']) });
    await client.analytics.flush();

    expect(posts()[0].events[0]).toMatchObject({ eventType: 'purchaseComplete' });
    // SKU-1 and SKU-3 are the same product, its concepts are sent once, the most specific first
    expect(interest().map((row) => row[0])).toEqual([
      'features/battery-18v',
      'features/cordless',
      'features/outdoor',
      'brands/acme',
      'features/garden',
    ]);
    expect(new Set(interest().map((row) => row[1]))).toEqual(new Set(['purchase']));
    expect(conceptEvents()[0].properties).toMatchObject({ orderId: 'order-1' });
  });

  it('caps the concepts of an order in total and of other events per event', async () => {
    const client = buildClient({ maxConceptsPerOrder: 2, maxConceptsPerEvent: 1 });

    await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']) });
    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(interest(0).map((row) => row[0])).toEqual(['features/battery-18v', 'features/cordless']);
    expect(interest(1).map((row) => row[0])).toEqual(['features/battery-18v']);
  });

  it('sends no concept events for impressions and does not look the products up', async () => {
    const client = buildClient();

    await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }, { key: 'p2' }] });
    await client.analytics.productCarouselViewed({ carousel: { carouselName: 'Trending' }, products: [{ key: 'p1' }] });
    await client.analytics.flush();

    expect(posts().flatMap((p) => p.events.map((e) => e.eventType))).toEqual(['product_view', 'product_view', 'product_view']);
    expect(products.lookups).toEqual([]);
  });

  it('degrades to the existing events when the lookup fails or the product has no concepts', async () => {
    const client = buildClient();

    await client.analytics.productViewed({ product: { key: 'missing' } });
    await client.analytics.productViewed({ product: { key: 'bare' } });
    await client.analytics.productViewed({ product: { key: 'unknown' } });
    products.failWith = 'throw';
    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.orderPlaced({ order: order(['SKU-1']) });
    await client.analytics.flush();

    const sent = posts().map((p) => p.events.map((e) => e.eventType));
    expect(sent).toEqual([['product_view'], ['product_view'], ['product_view'], ['product_view'], ['purchaseComplete']]);
  });

  it('sends the order and the add to cart as before when the concept lookup fails', async () => {
    products.failWith = 'error';
    const client = buildClient();

    await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
    await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-404']) });
    await client.analytics.flush();

    expect(posts().map((p) => p.events.map((e) => e.eventType))).toEqual([['addToCart'], ['purchaseComplete']]);
  });

  it('only sends the configured vocabularies', async () => {
    const client = buildClient({ conceptInterestVocabularies: ['brands'] });

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(interest()).toEqual([['brands/acme', 'product_view', 'brands']]);
  });

  it('encodes the slash of the concept id in the item id on request, the vocabulary stays plain', async () => {
    const client = buildClient({ encodeConceptIdSlash: true });
    const plain = buildClient();

    await client.analytics.productViewed({ product: { key: 'p2' } });
    await plain.analytics.productViewed({ product: { key: 'p2' } });
    await client.analytics.flush();
    await plain.analytics.flush();

    expect(interest(0)).toEqual([
      ['features__cordless', 'product_view', 'features'],
      ['features__garden', 'product_view', 'features'],
    ]);
    expect(interest(1).map((row) => row[0])).toEqual(['features/cordless', 'features/garden']);
  });

  it('sends no concept events when concept interest is switched off', async () => {
    const client = buildClient({ conceptInterest: false });
    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();
    expect(posts().map((p) => p.events.map((e) => e.eventType))).toEqual([['product_view']]);
  });

  describe('content-viewed', () => {
    it('sends a concept_interest per concept of the content', async () => {
      const client = buildClient();

      await client.analytics.contentViewed({
        content: { key: 'article-1', type: 'article' },
        concepts: ['features/cordless', 'brands/acme', 'features/outdoor'],
      });
      await client.analytics.flush();

      // in the order of the caller, which is its priority
      expect(posts()[0].events).toEqual([
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/cordless', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'features', contentId: 'article-1', contentType: 'article' } },
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'brands/acme', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'brands', contentId: 'article-1', contentType: 'article' } },
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/outdoor', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'features', contentId: 'article-1', contentType: 'article' } },
      ]);
      expect(products.lookups).toEqual([]);
    });

    it('applies the vocabularies, the cap and the slash encoding', async () => {
      const client = buildClient({ conceptInterestVocabularies: ['features'], maxConceptsPerEvent: 1, encodeConceptIdSlash: true });

      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['brands/acme', 'features/outdoor', 'features/cordless'] });
      await client.analytics.flush();

      // brands is filtered out, the cap keeps the first of the caller's order
      expect(interest()).toEqual([['features__outdoor', 'content_view', 'features']]);
      expect(conceptEvents()[0].properties).not.toHaveProperty('contentType');
    });

    it('sends nothing without concepts or when switched off', async () => {
      const client = buildClient();
      const off = buildClient({ conceptInterest: false });
      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: [] });
      await off.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['features/cordless'] });
      await client.analytics.flush();
      await off.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('one id for a concept on every path', () => {
    it('sends only the normalized valid ids of a product, once each', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'dirty' } });
      await client.analytics.flush();

      expect(interest().map((row) => [row[0], row[2]])).toEqual([
        ['features/cordless', 'features'],
        ['features/outdoor', 'features'],
      ]);
    });

    it('sends the same item id for a concept from a product and from an article', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'dirty' } });
      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['  FEATURES/Cordless'] });
      await client.analytics.flush();

      const fromProduct = conceptEvents(0).find((e) => e.target?.['itemId'] === 'features/cordless');
      const fromContent = conceptEvents(1)[0];
      expect(fromProduct?.target).toEqual(fromContent.target);
      expect(JSON.stringify(fromProduct?.target)).toBe(JSON.stringify(fromContent.target));
    });

    it('normalizes the same way for add to cart, order and the slash encoding', async () => {
      products = new StubProductCapability(new NoOpCache(), context);
      skuProducts['SKU-DIRTY'] = 'dirty';
      try {
        const client = buildClient({ encodeConceptIdSlash: true });
        const dirtyCart = CartSchema.parse({
          identifier: { key: 'cart-1' },
          user: { userId: 'user-1' },
          items: [{ identifier: { key: 'l1' }, product: { key: 'dirty' }, variant: { sku: 'SKU-DIRTY' }, quantity: 1, price: price(5) }],
        });

        await client.analytics.cartItemAdded({ cart: dirtyCart, variant: { sku: 'SKU-DIRTY' }, quantity: 1 });
        await client.analytics.orderPlaced({ order: order(['SKU-DIRTY']) });
        await client.analytics.flush();

        expect(interest(0).map((row) => row[0])).toEqual(['features__cordless', 'features__outdoor']);
        expect(interest(1).map((row) => row[0])).toEqual(['features__cordless', 'features__outdoor']);
      } finally {
        delete skuProducts['SKU-DIRTY'];
      }
    });

    it('matches the configured vocabularies in lowercase on the product and the content path', async () => {
      const client = buildClient({ conceptInterestVocabularies: [' Features '] });

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['brands/acme', 'features/outdoor', 'Features/Cordless'] });
      await client.analytics.flush();

      expect(interest(0).map((row) => row[0])).toEqual(['features/battery-18v', 'features/outdoor']);
      expect(interest(1).map((row) => row[0])).toEqual(['features/outdoor', 'features/cordless']);
    });
  });

  describe('warnings', () => {
    it('writes at most one warning per event type per minute', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        products.failWith = 'throw';
        const client = buildClient();

        for (let i = 0; i < 3; i++) {
          await client.analytics.productViewed({ product: { key: `p${i}` } });
        }
        await client.analytics.productClicked({ product: { key: 'p1' } });
        await client.analytics.flush();
        // one for product-viewed, one for product-clicked, the other two product views are throttled
        expect(warn.mock.calls.map((call) => String(call[0]).includes('product-viewed'))).toEqual([true, false]);
        expect(warn).toHaveBeenCalledTimes(2);

        vi.setSystemTime(new Date('2026-01-01T10:00:59Z'));
        await client.analytics.productViewed({ product: { key: 'p9' } });
        await client.analytics.flush();
        expect(warn).toHaveBeenCalledTimes(2);

        vi.setSystemTime(new Date('2026-01-01T10:01:01Z'));
        await client.analytics.productViewed({ product: { key: 'p9' } });
        await client.analytics.flush();
        expect(warn).toHaveBeenCalledTimes(3);
        expect(warn.mock.calls.every((call) => !String(call[0]).includes('p9'))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('lets a throttle be driven by its own clock', () => {
      let now = 1000;
      const throttle = new WarningThrottle(60_000, () => now);

      expect(throttle.allow('a')).toBe(true);
      expect(throttle.allow('a')).toBe(false);
      expect(throttle.allow('b')).toBe(true);
      now += 59_999;
      expect(throttle.allow('a')).toBe(false);
      now += 1;
      expect(throttle.allow('a')).toBe(true);
      throttle.reset();
      expect(throttle.allow('b')).toBe(true);
    });
  });

  describe('order lookups', () => {
    const bulkOrder = (count: number) => order(Array.from({ length: count }, (_, i) => `BULK-${i}`));

    it('looks every distinct sku up exactly once and never more than five at a time', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({ order: bulkOrder(50) });
      await client.analytics.flush();

      expect(products.skuLookups).toHaveLength(50);
      expect(new Set(products.skuLookups).size).toBe(50);
      expect(products.peak).toBeLessThanOrEqual(5);
      expect(products.peak).toBeGreaterThan(1);
      expect(interest().map((row) => row[0])).toHaveLength(5);
    });

    it('looks a sku used on several lines up once', async () => {
      const client = buildClient();

      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-1', 'SKU-2', 'SKU-1']) });
      await client.analytics.flush();

      expect(products.skuLookups.sort()).toEqual(['SKU-1', 'SKU-2']);
    });

    it('keeps the concepts of the other lines when one sku throws, and logs it once without the sku', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      products.throwForSkus.add('SKU-1');
      const client = buildClient();

      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']) });
      await client.analytics.flush();

      expect(posts()[0].events[0]).toMatchObject({ eventType: 'purchaseComplete' });
      expect(interest().map((row) => row[0])).toEqual(['features/cordless', 'features/garden']);
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0][0]);
      expect(message).toContain('order-placed');
      expect(message).not.toContain('SKU-1');
    });

    it('looks nothing up when no concepts are wanted for orders', async () => {
      const client = buildClient({ maxConceptsPerOrder: 0 });

      await client.analytics.orderPlaced({ order: bulkOrder(10) });
      await client.analytics.flush();

      expect(products.skuLookups).toEqual([]);
      expect(posts()[0].events.map((e) => e.eventType)).toEqual(['purchaseComplete']);
    });
  });

  describe('without a marketing profile', () => {
    beforeEach(() => {
      context.session.marketingContext.identifier.key = '';
    });

    it('does no lookups and sends nothing for any event', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.productClicked({ product: { key: 'p1' } });
      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']) });
      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['features/cordless'] });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(products.lookups).toEqual([]);
      expect(products.skuLookups).toEqual([]);
    });

    it('still sends a login on the profile the visitor had before it', async () => {
      const client = buildClient();

      await client.analytics.userLoggedIn({
        identity: { type: 'Anonymous' },
        previousMarketingId: { key: 'previous-profile' },
      });
      await client.analytics.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ profileId: 'previous-profile', events: [{ eventType: 'login' }] });
    });
  });

  describe('failures are logged without the payload', () => {
    it('warns once per failed event with the event type and the kind of error only', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      products.failWith = 'throw';
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'secret-product-id' } });
      await client.analytics.flush();

      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0][0]);
      expect(message).toContain('product-viewed');
      expect(message).toContain('Error');
      expect(message).not.toContain('secret-product-id');
      expect(message).not.toContain('backend down');
      expect(posts()[0].events.map((e) => e.eventType)).toEqual(['product_view']);
    });

    it('does not warn when a product simply has no concepts or is not found', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'bare' } });
      await client.analytics.productViewed({ product: { key: 'missing' } });
      await client.analytics.flush();

      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('sends the existing events byte for byte as without concept interest, only the concept events come on top', async () => {
    const run = async (conceptInterest: boolean) => {
      fetchMock.mockClear();
      products = new StubProductCapability(new NoOpCache(), context);
      const client = buildClient({ conceptInterest });
      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.productClicked({ product: { key: 'p2' }, origin: fromSearch(search, 3) });
      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 2 });
      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']) });
      await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }] });
      await client.analytics.flush();
      return posts();
    };

    const off = await run(false);
    const on = await run(true);

    expect(on).toHaveLength(off.length);
    for (let i = 0; i < off.length; i++) {
      const withoutConcepts = on[i].events.filter((e) => e.eventType !== 'concept_interest');
      expect(JSON.stringify(withoutConcepts)).toBe(JSON.stringify(off[i].events));
      // the concept events come after the existing ones
      expect(on[i].events.slice(0, off[i].events.length)).toEqual(off[i].events);
    }
    expect(on.flatMap((p) => p.events).some((e) => e.eventType === 'concept_interest')).toBe(true);
    expect(off.flatMap((p) => p.events).some((e) => e.eventType === 'concept_interest')).toBe(false);
  });

  describe('content ids from the caller', () => {
    const sentIds = async (concepts: string[], options: Record<string, unknown> = {}) => {
      fetchMock.mockClear();
      const client = buildClient(options);
      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts });
      await client.analytics.flush();
      return fetchMock.mock.calls.length === 0 ? [] : interest().map((row) => row[0]);
    };

    it('drops what is no concept id and normalizes the rest', async () => {
      expect(
        await sentIds([
          '',
          '   ',
          'noslash',
          'Features/Cordless',
          '  features/outdoor  ',
          'features/with.dot',
          'features/two/slashes',
          '/leading',
          'trailing/',
          'brands/acme!',
          'brands/acme',
        ]),
      ).toEqual(['features/cordless', 'features/outdoor', 'brands/acme']);
    });

    it('sends a duplicate once, also in a different case', async () => {
      expect(await sentIds(['features/cordless', 'FEATURES/CORDLESS', ' features/cordless ', 'brands/acme'])).toEqual(['features/cordless', 'brands/acme']);
    });

    it('keeps the order of the caller and cuts the cap in that order', async () => {
      const ids = ['features/zeta', 'brands/acme', 'features/alpha', 'features/mid'];

      expect(await sentIds(ids)).toEqual(ids);
      expect(await sentIds(ids, { maxConceptsPerEvent: 2 })).toEqual(['features/zeta', 'brands/acme']);
    });

    it('sends an ancestor closure as it is given, the caller is to pass the direct tags', async () => {
      expect(await sentIds(['features/power', 'features/cordless', 'features/battery-18v'])).toEqual(['features/power', 'features/cordless', 'features/battery-18v']);
    });

    it('drops an id over 128 characters in the sender as well, in case the schema is bypassed', () => {
      const atLimit = `features/${'x'.repeat(119)}`;

      expect(atLimit).toHaveLength(128);
      expect(normalizeConceptId(atLimit)).toBe(atLimit);
      expect(normalizeConceptId(`${atLimit}x`)).toBeUndefined();
      expect(contentInterestConcepts([`${atLimit}x`, 'features/ok'], { max: 5 }).map((c) => c.id)).toEqual(['features/ok']);
      // not strings never get this far through the schema, but must not throw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(contentInterestConcepts([42, null, 'features/ok'] as any, { max: 5 }).map((c) => c.id)).toEqual(['features/ok']);
    });

    it('rejects too many ids and too long ids at the core schema', async () => {
      const client = buildClient();

      const tooMany = await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: Array.from({ length: 51 }, (_, i) => `features/c${i}`) });
      const tooLong = await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: [`features/${'x'.repeat(130)}`] });
      const maximum = await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: Array.from({ length: 50 }, (_, i) => `features/c${i}`) });
      await client.analytics.flush();

      expect(tooMany.success).toBe(false);
      expect(tooLong.success).toBe(false);
      expect(maximum.success).toBe(true);
    });
  });

  describe('the configuration', () => {
    it('applies the defaults of a partial configuration given to withUnomiCapabilities', async () => {
      const client = new ClientBuilder(context)
        .withCache(new NoOpCache())
        .withCapability(withUnomiCapabilities({ apiUrl: 'https://unomi.example.invalid' }, { analytics: { enabled: true } }))
        .withCapability(() => ({ product: products }))
        .build();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      const events = posts()[0].events;
      expect(events[0]).toMatchObject({ eventType: 'product_view', scope: 'default' });
      // the default of five concepts per event and of conceptInterest being on
      expect(conceptEvents().map((e) => e.target?.['itemId'])).toEqual(['features/battery-18v', 'features/outdoor', 'brands/acme']);
      expect(conceptEvents()[0].scope).toBe('default');
    });

    it('lets the capability be constructed with a partial configuration', () => {
      const capability = new UnomiAnalyticsCapability(new NoOpCache(), context, { apiUrl: 'https://unomi.example.invalid' });

      expect(capability.types).toContain('content-viewed');
    });
  });

  describe('capping across vocabularies and lines', () => {
    const flat = (...ids: string[]) => ids.map((id) => concept(id));

    it('mixes the vocabularies at equal depth when the cap bites, instead of favouring the alphabet', () => {
      const lists = [flat('brands/a', 'brands/b', 'brands/c', 'features/x', 'features/y')];

      const result = selectInterestConcepts(lists, { max: 3 });

      expect(result.map((c) => c.id)).toEqual(['brands/a', 'features/x', 'brands/b']);
      // and not the other way around when the other vocabulary appears first
      expect(selectInterestConcepts([flat('features/x', 'brands/a', 'features/y')], { max: 2 }).map((c) => c.id)).toEqual(['features/x', 'brands/a']);
    });

    it('still ranks depth before the mixing', () => {
      const deep = [concept('features/top'), concept('features/mid', 'features/top'), concept('features/leaf', 'features/mid'), concept('brands/a'), concept('colors/b')];

      const result = selectInterestConcepts([deep], { max: 2 });

      expect(result.map((c) => c.id)).toEqual(['features/leaf', 'brands/a']);
    });

    it('puts a concept on more lines of an order first', () => {
      const lines = [flat('brands/a', 'features/once'), flat('features/twice', 'colors/x'), flat('features/twice', 'brands/b'), flat('features/twice', 'colors/x')];

      const result = selectInterestConcepts(lines, { max: 3 });

      expect(result.map((c) => c.id)).toEqual(['features/twice', 'colors/x', 'brands/a']);
    });

    it('is deterministic and stable by first appearance', () => {
      const lists = [flat('features/b', 'brands/z', 'features/a', 'brands/y')];

      const first = selectInterestConcepts(lists, { max: 4 }).map((c) => c.id);
      const second = selectInterestConcepts(lists, { max: 4 }).map((c) => c.id);

      expect(first).toEqual(['features/b', 'brands/z', 'features/a', 'brands/y']);
      expect(second).toEqual(first);
    });
  });
});

describe('selectInterestConcepts', () => {
  it('keeps the direct concepts, most specific first, and caps', () => {
    const result = selectInterestConcepts([richConcepts], { max: 10 });

    expect(result.map((c) => [c.id, c.depth])).toEqual([
      ['features/battery-18v', 2],
      ['features/outdoor', 0],
      ['brands/acme', 0],
    ]);
    expect(selectInterestConcepts([richConcepts], { max: 2 }).map((c) => c.id)).toEqual(['features/battery-18v', 'features/outdoor']);
    expect(selectInterestConcepts([richConcepts], { max: 0 })).toEqual([]);
  });

  it('de-duplicates over products and keeps the deepest depth of a concept', () => {
    const result = selectInterestConcepts([richConcepts, [concept('features/outdoor', 'features/power'), concept('features/power')], undefined, []], { max: 10 });

    expect(result.map((c) => [c.id, c.depth])).toEqual([
      ['features/battery-18v', 2],
      ['features/outdoor', 1],
      ['brands/acme', 0],
    ]);
  });

  it('survives parent cycles and derives the vocabulary from the id when it is missing', () => {
    const looped = [
      { identifier: { key: 'a/x' }, parent: { key: 'a/y' }, name: 'x', vocabulary: '' },
      { identifier: { key: 'a/y' }, parent: { key: 'a/x' }, name: 'y', vocabulary: '' },
      { identifier: { key: 'b/z' }, name: 'z', vocabulary: '' },
    ];

    const result = selectInterestConcepts([looped], { max: 10 });

    expect(result.map((c) => [c.id, c.vocabulary])).toEqual([['b/z', 'b']]);
  });
});
