import {
  CartSchema,
  ClientBuilder,
  NoOpCache,
  OrderSchema,
  CostBreakDownSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { RequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HclAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { HclClient } from '../core/client.js';
import { SESSION_KEY_PERSONALIZATION_ID } from '../core/session-keys.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';

const price = (value: number) => ({
  unitPrice: { currency: 'EUR', value },
  totalDiscount: { currency: 'EUR', value: 0 },
  totalPrice: { currency: 'EUR', value },
  unitDiscount: { currency: 'EUR', value: 0 },
});

describe('HCL Analytics Capability', () => {
  let context: RequestContext;
  let callPost: ReturnType<typeof vi.spyOn<HclClient, 'callPost'>>;
  let client: ReturnType<typeof build>;

  const build = () => {
    const config = HclConfigurationSchema.parse({ apiUrl: 'https://hcl.example.invalid', storeId: '41' });
    const hclClient = new HclClient(config, context);
    callPost = vi.spyOn(hclClient, 'callPost').mockResolvedValue({});
    const provider = new HclAnalyticsCapability(new NoOpCache(), context, config, hclClient);
    return new ClientBuilder(context).withCache(new NoOpCache()).withCapability(() => ({ analytics: provider })).build();
  };

  const posted = () => callPost.mock.calls.map(([url, body]) => ({ url, body }));

  const cart = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [{ identifier: { key: 'l1' }, product: { key: 'P-1' }, variant: { sku: 'SKU-1' }, quantity: 1, price: price(10) }],
    });

  beforeEach(() => {
    context = createInitialRequestContext();
    client = build();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts one event per product of a search result or carousel, in order', async () => {
    await client.analytics.searchResultsViewed({
      search: { term: 'chair', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } },
      products: [{ key: 'P-1' }, { key: 'P-2' }],
    });
    await client.analytics.productCarouselViewed({ carousel: { carouselName: 'Trending' }, products: [{ key: 'P-3' }] });
    await client.analytics.flush();

    expect(posted()).toEqual([
      { url: 'https://hcl.example.invalid/wcs/resources/store/41/event', body: { productId: 'P-1' } },
      { url: 'https://hcl.example.invalid/wcs/resources/store/41/event', body: { productId: 'P-2' } },
      { url: 'https://hcl.example.invalid/wcs/resources/store/41/event', body: { productId: 'P-3' } },
    ]);
  });

  it('posts clicks and product views for the product', async () => {
    await client.analytics.productClicked({ product: { key: 'P-1' } });
    await client.analytics.productViewed({ product: { key: 'P-2' } });
    await client.analytics.flush();

    expect(posted().map((p) => p.body)).toEqual([{ productId: 'P-1' }, { productId: 'P-2' }]);
  });

  it('posts add to cart with the product key of the cart line', async () => {
    await client.analytics.cartItemAdded({ cart: cart(), variant: { sku: 'SKU-1' }, quantity: 1 });
    await client.analytics.flush();

    expect(posted().map((p) => p.body)).toEqual([{ productId: 'P-1' }]);
  });

  it('posts one event per order line with its sku', async () => {
    const order = OrderSchema.parse({
      identifier: { key: 'order-1' },
      userId: { userId: 'user-1' },
      items: ['SKU-1', 'SKU-2'].map((sku, i) => ({
        identifier: { key: `line-${i}` },
        inventoryStatus: 'Allocated',
        price: price(10),
        quantity: 1,
        variant: { sku },
      })),
      price: CostBreakDownSchema.parse({}),
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'Allocated',
      paymentInstructions: [],
    });

    await client.analytics.orderPlaced({ order });
    await client.analytics.flush();

    expect(posted().map((p) => p.body)).toEqual([{ productId: 'SKU-1' }, { productId: 'SKU-2' }]);
  });

  it('includes the personalization id of the session when there is one', async () => {
    context.session[SESSION_KEY_PERSONALIZATION_ID] = 'hcl-personalization-1';

    await client.analytics.productViewed({ product: { key: 'P-1' } });
    await client.analytics.flush();

    expect(posted()[0].body).toEqual({ productId: 'P-1', personalizationID: 'hcl-personalization-1' });
  });

  it('ignores events HCL has no use for', async () => {
    await client.analytics.cartViewed({ cart: cart() });
    await client.analytics.custom({ name: 'x', payload: {} });
    await client.analytics.flush();

    expect(callPost).not.toHaveBeenCalled();
  });

  it('logs a failing request without surfacing it to the storefront', async () => {
    callPost.mockRejectedValue(new Error('hcl down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await client.analytics.productViewed({ product: { key: 'P-1' } });

    expect(result.success).toBe(true);
    await expect(client.analytics.flush()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
