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
import { selectInterestConcepts } from '../core/concept-interest.js';
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
  p2: otherConcepts,
  bare: [],
  unknown: undefined,
};
const skuProducts: Record<string, string> = { 'SKU-1': 'p1', 'SKU-2': 'p2', 'SKU-3': 'p1', 'SKU-B': 'bare' };

class StubProductCapability extends ProductCapability {
  public lookups: string[] = [];
  public failWith: 'throw' | 'error' | undefined;

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
    return this.getById({ identifier: { key: skuProducts[payload.variant.sku] ?? 'missing' } });
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
      { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'brands/acme', itemType: 'concept' }, properties: { source: 'product_view', vocabulary: 'brands', productId: 'p1' } },
      { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/outdoor', itemType: 'concept' }, properties: { source: 'product_view', vocabulary: 'features', productId: 'p1' } },
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
    expect(interest(1).map((row) => row[0])).toEqual(['features/battery-18v', 'brands/acme', 'features/outdoor']);
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
      'brands/acme',
      'features/garden',
      'features/outdoor',
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

      expect(posts()[0].events).toEqual([
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'brands/acme', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'brands', contentId: 'article-1', contentType: 'article' } },
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/cordless', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'features', contentId: 'article-1', contentType: 'article' } },
        { eventType: 'concept_interest', scope: 'test-scope', target: { itemId: 'features/outdoor', itemType: 'concept' }, properties: { source: 'content_view', vocabulary: 'features', contentId: 'article-1', contentType: 'article' } },
      ]);
      expect(products.lookups).toEqual([]);
    });

    it('applies the vocabularies, the cap and the slash encoding', async () => {
      const client = buildClient({ conceptInterestVocabularies: ['features'], maxConceptsPerEvent: 1, encodeConceptIdSlash: true });

      await client.analytics.contentViewed({ content: { key: 'a1' }, concepts: ['brands/acme', 'features/outdoor', 'features/cordless'] });
      await client.analytics.flush();

      expect(interest()).toEqual([['features__cordless', 'content_view', 'features']]);
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
});

describe('selectInterestConcepts', () => {
  it('keeps the direct concepts, most specific first, then by id, and caps', () => {
    const result = selectInterestConcepts([richConcepts], { max: 10 });

    expect(result.map((c) => [c.id, c.depth])).toEqual([
      ['features/battery-18v', 2],
      ['brands/acme', 0],
      ['features/outdoor', 0],
    ]);
    expect(selectInterestConcepts([richConcepts], { max: 2 }).map((c) => c.id)).toEqual(['features/battery-18v', 'brands/acme']);
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
