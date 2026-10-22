import {
  CartSchema,
  ClientBuilder,
  CostBreakDownSchema,
  NoOpCache,
  OrderSchema,
  ProductCapability,
  createInitialRequestContext,
  error,
  fromSearch,
  success,
} from '@reactionary/core';
import type { Product, RequestContext, Result, SearchIdentifier } from '@reactionary/core';
import { hash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnomiAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { UnomiConfigurationSchema } from '../schema/configuration.schema.js';

const fetchMock = vi.fn<typeof fetch>();

const price = (value: number) => ({
  unitPrice: { currency: 'EUR', value },
  totalDiscount: { currency: 'EUR', value: 0 },
  totalPrice: { currency: 'EUR', value },
  unitDiscount: { currency: 'EUR', value: 0 },
});

class StubProductCapability extends ProductCapability {
  public override async getById(payload: { identifier: { key: string } }): Promise<Result<Product>> {
    return payload.identifier.key === 'missing'
      ? error({ type: 'NotFound', identifier: 'missing' })
      : success({ identifier: payload.identifier, name: `Name of ${payload.identifier.key}` } as unknown as Product);
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(): Promise<never> {
    throw new Error('not implemented');
  }
}

const search: SearchIdentifier = { term: 'cable', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };

describe('Unomi Analytics Capability', () => {
  let context: RequestContext;

  const config = UnomiConfigurationSchema.parse({
    apiUrl: 'https://unomi.example.invalid',
    scope: 'test-scope',
    username: 'unomi-user',
    password: 'unomi-password',
  });

  const buildClient = () =>
    new ClientBuilder(context)
      .withCache(new NoOpCache())
      .withCapability(() => ({ analytics: new UnomiAnalyticsCapability(new NoOpCache(), context, config) }))
      .withCapability(() => ({ product: new StubProductCapability(new NoOpCache(), context) }))
      .build();

  /** The request bodies posted to Unomi so far. */
  const posts = () =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {
      source: Record<string, unknown>;
      profileId: string;
      events: Array<{ eventType: string; scope: string; target?: Record<string, any>; properties?: Record<string, any> }>;
    });

  const cart = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [{ identifier: { key: 'l1' }, product: { key: 'p1' }, variant: { sku: 'SKU-1' }, quantity: 3, price: price(12.5) }],
    });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    context = createInitialRequestContext();
    context.session.marketingContext.identifier.key = 'profile-1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to the context endpoint with credentials, the source and the visitor profile', async () => {
    const client = buildClient();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://unomi.example.invalid/cxs/context.json',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authorization: `Basic ${btoa('unomi-user:unomi-password')}` }) }),
    );
    expect(posts()).toEqual([
      {
        source: { itemType: 'page', scope: 'test-scope', itemId: 'backend' },
        profileId: 'profile-1',
        events: [{ eventType: 'product_view', scope: 'test-scope', target: { itemId: 'p1', itemType: 'product' } }],
      },
    ]);
  });

  it('sends one product_view per product of a result list or carousel in a single request', async () => {
    const client = buildClient();

    await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }, { key: 'p2' }] });
    await client.analytics.productCarouselViewed({ carousel: { carouselName: 'Trending' }, products: [{ key: 'p3' }] });
    await client.analytics.flush();

    expect(posts().map((p) => p.events.map((e) => e.target?.['itemId']))).toEqual([['p1', 'p2'], ['p3']]);
  });

  it('sends selectItem with the absolute position and search term from the search origin', async () => {
    const client = buildClient();

    await client.analytics.productClicked({ product: { key: 'p1' }, origin: fromSearch(search, 24) });
    await client.analytics.productClicked({ product: { key: 'p2' } });
    await client.analytics.flush();

    expect(posts()[0].events[0]).toMatchObject({ eventType: 'selectItem', target: { itemId: 'p1' }, properties: { index: 24, searchTerm: 'cable' } });
    expect(posts()[1].events[0].properties).toBeUndefined();
  });

  describe('cart', () => {
    it('sends addToCart with the real price, currency, quantity, sku and product name', async () => {
      const client = buildClient();

      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 2 });
      await client.analytics.flush();

      expect(posts()[0].events).toEqual([
        {
          eventType: 'addToCart',
          scope: 'test-scope',
          target: {
            itemId: 'p1',
            itemType: 'product',
            customItemType: 'product',
            properties: { sku: 'SKU-1', price: 12.5, currency: 'EUR', quantity: 2, productName: 'Name of p1' },
          },
        },
      ]);
    });

    it('leaves the product name out instead of sending a placeholder when it cannot be looked up', async () => {
      const client = buildClient();
      const missing = CartSchema.parse({
        identifier: { key: 'cart-1' },
        user: { userId: 'user-1' },
        items: [{ identifier: { key: 'l1' }, product: { key: 'missing' }, variant: { sku: 'SKU-9' }, quantity: 1, price: price(5) }],
      });

      await client.analytics.cartItemAdded({ cart: missing, variant: { sku: 'SKU-9' }, quantity: 1 });
      await client.analytics.flush();

      const properties = posts()[0].events[0].target?.['properties'];
      expect(properties).toEqual({ sku: 'SKU-9', price: 5, currency: 'EUR', quantity: 1 });
    });

    it('sends nothing when the variant is not in the cart', async () => {
      const client = buildClient();

      await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-404' }, quantity: 1 });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('sends purchaseComplete with the order id, totals and line items', async () => {
    const client = buildClient();
    const order = OrderSchema.parse({
      identifier: { key: 'order-1' },
      userId: { userId: 'user-1' },
      items: ['SKU-1', 'SKU-2'].map((sku, i) => ({
        identifier: { key: `line-${i}` },
        inventoryStatus: 'Allocated',
        price: price(10 * (i + 1)),
        quantity: i + 1,
        variant: { sku },
      })),
      price: { ...CostBreakDownSchema.parse({}), grandTotal: { currency: 'EUR', value: 50 } },
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'Allocated',
      paymentInstructions: [],
    });

    await client.analytics.orderPlaced({ order });
    await client.analytics.flush();

    expect(posts()[0].events).toEqual([
      {
        eventType: 'purchaseComplete',
        scope: 'test-scope',
        target: { itemId: 'order-1', itemType: 'order' },
        properties: {
          orderId: 'order-1',
          totalAmount: 50,
          currency: 'EUR',
          itemCount: 2,
          items: [
            { sku: 'SKU-1', quantity: 1, price: 10 },
            { sku: 'SKU-2', quantity: 2, price: 20 },
          ],
        },
      },
    ]);
  });

  describe('login', () => {
    const identity = { type: 'Registered', id: { userId: 'user-1' } } as const;

    it('sends a login event on the profile the visitor had before logging in, with a hashed user id', async () => {
      const client = buildClient();

      await client.analytics.userLoggedIn({ identity, previousMarketingId: { key: 'anonymous-profile' } });
      await client.analytics.flush();

      expect(posts()[0]).toMatchObject({
        profileId: 'anonymous-profile',
        events: [{ eventType: 'login', scope: 'test-scope', properties: { userId: hash('sha256', 'user-1') } }],
      });
      expect(JSON.stringify(posts()[0])).not.toContain('"user-1"');
    });

    it('falls back to the current profile when the previous one is not known', async () => {
      const client = buildClient();

      await client.analytics.userLoggedIn({ identity });
      await client.analytics.flush();

      expect(posts()[0].profileId).toBe('profile-1');
    });
  });

  describe('attribution and consent', () => {
    it('takes the profile from emit time, not from when the event is sent', async () => {
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      context.session.marketingContext.identifier.key = 'profile-2';
      await client.analytics.flush();

      expect(posts()[0].profileId).toBe('profile-1');
    });

    it('ignores events without a marketing identifier rather than creating throwaway profiles', async () => {
      context.session.marketingContext.identifier.key = '';
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is skipped when marketing consent is not granted', async () => {
      context.session.consent = { analytics: true, marketing: false };
      const client = buildClient();

      await client.analytics.productViewed({ product: { key: 'p1' } });
      await client.analytics.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('ignores events Unomi has no use for and never dumps payloads to the console', async () => {
    const client = buildClient();

    await client.analytics.cartViewed({ cart: cart() });
    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(posts()).toHaveLength(1);
    expect(console.dir).not.toHaveBeenCalled();
  });

  it('logs a failing request without surfacing it to the storefront', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = buildClient();

    const result = await client.analytics.productViewed({ product: { key: 'p1' } });

    expect(result.success).toBe(true);
    await expect(client.analytics.flush()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
