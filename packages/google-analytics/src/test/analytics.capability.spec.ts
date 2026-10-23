import {
  CartSchema,
  ClientBuilder,
  CostBreakDownSchema,
  NoOpCache,
  OrderSchema,
  PriceCapability,
  ProductCapability,
  createInitialRequestContext,
  error,
  fromSearch,
  success,
} from '@reactionary/core';
import type { Price, Product, ProductQueryBySKU, RequestContext, Result, SearchIdentifier } from '@reactionary/core';
import { hash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalyticsAnalyticsCapability, sessionIdAt } from '../capabilities/analytics.capability.js';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';

const fetchMock = vi.fn<typeof fetch>();

const itemPrice = (value: number, discount = 0) => ({
  unitPrice: { value, currency: 'EUR' },
  unitDiscount: { value: discount, currency: 'EUR' },
  totalPrice: { value, currency: 'EUR' },
  totalDiscount: { value: discount, currency: 'EUR' },
});

const product = (key: string, name: string) =>
  ({ identifier: { key }, name, brand: `${name} brand`, mainVariant: { identifier: { sku: `${key}-main` } } }) as unknown as Product;

class StubProductCapability extends ProductCapability {
  public lookups: string[] = [];
  public override async getById(payload: { identifier: { key: string } }): Promise<Result<Product>> {
    this.lookups.push(payload.identifier.key);
    return payload.identifier.key === 'missing'
      ? error({ type: 'NotFound', identifier: 'missing' })
      : success(product(payload.identifier.key, `Name of ${payload.identifier.key}`));
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(_payload: ProductQueryBySKU): Promise<never> {
    throw new Error('not implemented');
  }
}

class StubPriceCapability extends PriceCapability {
  public override async getListPrice(): Promise<Result<Price>> {
    return success({ unitPrice: { value: 20, currency: 'EUR' } } as unknown as Price);
  }
  public override async getCustomerPrice(): Promise<Result<Price>> {
    return success({ unitPrice: { value: 15, currency: 'EUR' } } as unknown as Price);
  }
}

const search: SearchIdentifier = { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 2, pageSize: 20 } };

describe('Google Analytics analytics provider', () => {
  let context: RequestContext;
  let products: StubProductCapability;

  const config = {
    apiSecret: 'test-api-secret',
    measurementId: 'G-TEST123',
    url: 'https://example.invalid/collect',
  } satisfies GoogleAnalyticsConfiguration;

  const buildClient = () =>
    new ClientBuilder(context)
      .withCache(new NoOpCache())
      .withCapability(() => ({ analytics: new GoogleAnalyticsAnalyticsCapability(new NoOpCache(), context, config) }))
      .withCapability(() => ({ product: products, price: new StubPriceCapability(new NoOpCache(), context) }))
      .build();

  /** The Measurement Protocol payloads sent so far. */
  const sent = () =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as { client_id: string; user_id?: string; timestamp_micros: number; events: { name: string; params: Record<string, unknown> }[] });
  /** The events sent, without the session and engagement fields every event carries (see its own test). */
  const sentEvents = () =>
    sent().flatMap((payload) =>
      payload.events.map(({ name, params }) => ({
        name,
        params: Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'session_id' && key !== 'engagement_time_msec')),
      }))
    );

  const cart = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [
        { identifier: { key: 'l1' }, product: { key: 'p1' }, variant: { sku: 'SKU-1' }, quantity: 2, price: itemPrice(25, 5) },
        { identifier: { key: 'l2' }, product: { key: 'p2' }, variant: { sku: 'SKU-2' }, quantity: 1, price: itemPrice(10) },
      ],
      price: { ...CostBreakDownSchema.parse({}), grandTotal: { value: 60, currency: 'EUR' }, totalProductPrice: { value: 60, currency: 'EUR' } },
    });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    context = createInitialRequestContext();
    products = new StubProductCapability(new NoOpCache(), context);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to the Measurement Protocol endpoint with the client id and event time', async () => {
    context.session.marketingContext.identifier.key = 'visitor-1';
    const client = buildClient();

    await client.analytics.pageViewed({ page: { type: 'home', url: 'https://shop.example/', title: 'Home' } });
    await client.analytics.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.invalid/collect?measurement_id=G-TEST123&api_secret=test-api-secret',
      expect.objectContaining({ method: 'POST' })
    );
    expect(sent()[0]).toMatchObject({ client_id: 'visitor-1', timestamp_micros: expect.any(Number) });
    expect(sentEvents()).toEqual([{ name: 'page_view', params: { page_location: 'https://shop.example/', page_title: 'Home' } }]);
  });

  it('sends a session id and an engagement time on every event', async () => {
    const client = buildClient();

    await client.analytics.pageViewed({ page: { type: 'home' } });
    await client.analytics.pageViewed({ page: { type: 'home' } });
    await client.analytics.flush();

    const [first, second] = sent().flatMap((payload) => payload.events);
    expect(first.params['engagement_time_msec']).toBe(100);
    expect(first.params['session_id']).toMatch(/^\d+$/);
    expect(second.params['session_id']).toBe(first.params['session_id']);
  });

  it('uses the session id of the request as the GA session', async () => {
    context.session.id = 'session-abc';
    const client = buildClient();

    await client.analytics.pageViewed({ page: { type: 'home' } });
    await client.analytics.flush();

    expect(sent()[0].events[0].params['session_id']).toBe('session-abc');
  });

  it('puts events in the same session within a 30 minute window and in another one after it', () => {
    expect(sessionIdAt('2026-10-23T10:00:00.000Z')).toBe(sessionIdAt('2026-10-23T10:29:59.000Z'));
    expect(sessionIdAt('2026-10-23T10:00:00.000Z')).not.toBe(sessionIdAt('2026-10-23T10:30:00.000Z'));
  });

  it('uses a hashed user id for registered visitors and none for anonymous ones', async () => {
    const client = buildClient();
    await client.analytics.pageViewed({ page: { type: 'home' } });
    context.session.identityContext.identity = { type: 'Registered', id: { userId: 'user-1' } };
    await client.analytics.pageViewed({ page: { type: 'home' } });
    await client.analytics.flush();

    expect(sent()[0].client_id).toBe('anonymous');
    expect(sent()[0].user_id).toBeUndefined();
    expect(sent()[1].user_id).toBe(hash('sha256', 'user-1'));
  });

  it('sends search and view_item_list with absolute item indexes', async () => {
    const client = buildClient();

    await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }, { key: 'p2' }] });
    await client.analytics.flush();

    expect(sentEvents()).toEqual([
      { name: 'search', params: { search_term: 'drill' } },
      {
        name: 'view_item_list',
        params: {
          item_list_id: 'search',
          item_list_name: 'Search: drill',
          items: [
            { item_id: 'p1', index: 20 },
            { item_id: 'p2', index: 21 },
          ],
        },
      },
    ]);
    expect(products.lookups).toEqual([]);
  });

  it('sends select_item with the list and position from the search origin, and the product name', async () => {
    const client = buildClient();

    await client.analytics.productClicked({ product: { key: 'p1' }, origin: fromSearch(search, 24) });
    await client.analytics.productClicked({ product: { key: 'p2' } });
    await client.analytics.flush();

    expect(sentEvents()).toEqual([
      {
        name: 'select_item',
        params: {
          item_list_id: 'search',
          item_list_name: 'Search: drill',
          items: [{ item_id: 'p1', item_name: 'Name of p1', item_brand: 'Name of p1 brand', index: 24 }],
        },
      },
      { name: 'select_item', params: { items: [{ item_id: 'p2', item_name: 'Name of p2', item_brand: 'Name of p2 brand' }] } },
    ]);
  });

  it('sends view_item with the customer price, and degrades when the product cannot be found', async () => {
    const client = buildClient();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.productViewed({ product: { key: 'missing' } });
    await client.analytics.flush();

    expect(sentEvents()).toEqual([
      { name: 'view_item', params: { currency: 'EUR', value: 15, items: [{ item_id: 'p1', item_name: 'Name of p1', item_brand: 'Name of p1 brand', price: 15 }] } },
      { name: 'view_item', params: { currency: context.languageContext.currencyCode, items: [{ item_id: 'missing' }] } },
    ]);
  });

  it('sends promotions', async () => {
    const client = buildClient();

    await client.analytics.promotionViewed({ promotion: { id: 'pr1', name: 'Summer', slot: 'hero', creative: 'banner-a' } });
    await client.analytics.promotionClicked({ promotion: { id: 'pr1', name: 'Summer', slot: 'hero' } });
    await client.analytics.flush();

    expect(sentEvents().map((e) => e.name)).toEqual(['view_promotion', 'select_promotion']);
    expect(sentEvents()[0].params).toEqual({ promotion_id: 'pr1', promotion_name: 'Summer', creative_slot: 'hero', creative_name: 'banner-a' });
  });

  describe('cart', () => {
    it('sends add_to_cart with the price, quantity, value and currency of the line', async () => {
      const client = buildClient();

      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
      await client.analytics.flush();

      expect(sentEvents()).toEqual([
        {
          name: 'add_to_cart',
          params: {
            currency: 'EUR',
            value: 25,
            items: [{ item_id: 'SKU-1', item_group_id: 'p1', quantity: 1, price: 25, discount: 5, item_name: 'Name of p1', item_brand: 'Name of p1 brand' }],
          },
        },
      ]);
    });

    it('sends remove_from_cart from a removed line, or from a sku still in the cart', async () => {
      const client = buildClient();
      const resulting = cart();

      await client.analytics.cartItemRemoved({ cart: resulting, removed: resulting.items[1] });
      await client.analytics.cartItemRemoved({ cart: resulting, removed: { sku: 'SKU-1' }, quantity: 1 });
      await client.analytics.flush();

      expect(sentEvents().map((e) => e.name)).toEqual(['remove_from_cart', 'remove_from_cart']);
      expect(sentEvents()[0].params).toMatchObject({ value: 10, items: [expect.objectContaining({ item_id: 'SKU-2', quantity: 1 })] });
      expect(sentEvents()[1].params).toMatchObject({ value: 25, items: [expect.objectContaining({ item_id: 'SKU-1', quantity: 1 })] });
    });

    it('translates a quantity change into add or remove of the delta', async () => {
      const client = buildClient();

      await client.analytics.cartItemQuantityChanged({ cart: cart(), variant: { sku: 'SKU-1' }, previousQuantity: 1, newQuantity: 3 });
      await client.analytics.cartItemQuantityChanged({ cart: cart(), variant: { sku: 'SKU-1' }, previousQuantity: 3, newQuantity: 2 });
      await client.analytics.cartItemQuantityChanged({ cart: cart(), variant: { sku: 'SKU-1' }, previousQuantity: 2, newQuantity: 2 });
      await client.analytics.flush();

      expect(sentEvents().map((e) => e.name)).toEqual(['add_to_cart', 'remove_from_cart']);
      expect(sentEvents().map((e) => (e.params['items'] as { quantity: number }[])[0].quantity)).toEqual([2, 1]);
    });

    it('sends nothing for a sku that is not in the cart', async () => {
      const client = buildClient();

      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-9' }, quantity: 1 });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends view_cart, begin_checkout, add_shipping_info and add_payment_info with the cart lines', async () => {
      const client = buildClient();

      await client.analytics.cartViewed({ cart: cart() });
      await client.analytics.checkoutStarted({ cart: cart() });
      await client.analytics.shippingInfoAdded({
        cart: cart(),
        shippingMethod: { identifier: { key: 'dhl' }, name: 'DHL', description: '', price: { value: 5, currency: 'EUR' }, deliveryTime: '2 days' } as never,
      });
      await client.analytics.flush();

      expect(sentEvents().map((e) => e.name)).toEqual(['view_cart', 'begin_checkout', 'add_shipping_info']);
      expect(sentEvents()[0].params).toMatchObject({
        currency: 'EUR',
        value: 60,
        items: [
          { item_id: 'SKU-1', item_group_id: 'p1', quantity: 2, price: 25, discount: 5 },
          { item_id: 'SKU-2', item_group_id: 'p2', quantity: 1, price: 10, discount: 0 },
        ],
      });
      expect(sentEvents()[2].params).toMatchObject({ shipping_tier: 'DHL' });
    });
  });

  it('sends the purchase with totals and lines from the order', async () => {
    const client = buildClient();
    const order = OrderSchema.parse({
      identifier: { key: 'ORDER-12345' },
      userId: { userId: 'test-user-123' },
      items: [
        { identifier: { key: 'item-1' }, variant: { sku: 'SKU-001' }, quantity: 2, price: itemPrice(29.99), inventoryStatus: 'Allocated' },
        { identifier: { key: 'item-2' }, variant: { sku: 'SKU-002' }, quantity: 1, price: itemPrice(49.99, 5), inventoryStatus: 'Allocated' },
      ],
      price: {
        totalTax: { value: 21.99, currency: 'EUR' },
        totalDiscount: { value: 5, currency: 'EUR' },
        totalSurcharge: { value: 0, currency: 'EUR' },
        totalShipping: { value: 4.99, currency: 'EUR' },
        totalProductPrice: { value: 104.97, currency: 'EUR' },
        grandTotal: { value: 126.95, currency: 'EUR' },
      },
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'Allocated',
      paymentInstructions: [],
    });

    await client.analytics.orderPlaced({ order });
    await client.analytics.flush();

    expect(sentEvents()).toEqual([
      {
        name: 'purchase',
        params: {
          currency: 'EUR',
          transaction_id: 'ORDER-12345',
          value: 126.95,
          tax: 21.99,
          shipping: 4.99,
          items: [
            { item_id: 'SKU-001', quantity: 2, price: 29.99, discount: 0 },
            { item_id: 'SKU-002', quantity: 1, price: 49.99, discount: 5 },
          ],
        },
      },
    ]);
  });

  it('sends account and engagement events', async () => {
    const client = buildClient();

    await client.analytics.userLoggedIn({ identity: { type: 'Registered', id: { userId: 'user-1' } } });
    await client.analytics.userRegistered({ identity: { type: 'Registered', id: { userId: 'user-1' } } });
    await client.analytics.wishlistItemAdded({ list: { listType: 'wish', key: 'w1' }, variant: { sku: 'SKU-1' } });
    await client.analytics.productShared({ product: { key: 'p1' }, channel: 'email' });
    await client.analytics.flush();

    expect(sentEvents()).toEqual([
      { name: 'login', params: {} },
      { name: 'sign_up', params: {} },
      { name: 'add_to_wishlist', params: { items: [{ item_id: 'SKU-1' }] } },
      { name: 'share', params: { method: 'email', content_type: 'product', item_id: 'p1' } },
    ]);
  });

  it('ignores events it has no use for', async () => {
    const client = buildClient();

    await client.analytics.custom({ name: 'x', payload: {} });
    await client.analytics.couponApplied({ cart: cart(), code: 'SAVE' });
    await client.analytics.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs a rejected request without surfacing it to the storefront', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = buildClient();

    const result = await client.analytics.pageViewed({ page: { type: 'home' } });

    expect(result.success).toBe(true);
    await expect(client.analytics.flush()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
