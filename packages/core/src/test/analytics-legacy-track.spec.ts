import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoOpCache } from '../cache/noop-cache.js';
import { ClientBuilder } from '../client/client-builder.js';
import { createInitialRequestContext } from '../initialization.js';
import {
  AnalyticsDispatcher,
  CartSchema,
  CostBreakDownSchema,
  LegacyAnalyticsProvider,
  OrderSchema,
  RecordingAnalyticsSubscriber,
  createAnalyticsContext,
  emitLegacyAnalyticsEvent,
  error,
  success,
} from '../index.js';
import type {
  AnalyticsMutationProductDetailsViewEvent,
  AnalyticsResult,
  AnalyticsSubscriber,
  PersonalizationProfile,
  Product,
  SearchIdentifier,
} from '../index.js';

const search: SearchIdentifier = { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };
const cart = CartSchema.parse({ identifier: { key: 'c1' }, user: { userId: 'u1' }, items: [] });

function setup() {
  const recorder = new RecordingAnalyticsSubscriber();
  const client = new ClientBuilder(createInitialRequestContext()).withCache(new NoOpCache()).withAnalyticsSubscriber(recorder).build();
  return { recorder, client };
}

describe('legacy client.analytics.track', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the AnalyticsResult return type and reports one accepted outcome', async () => {
    const { client } = setup();

    const result: AnalyticsResult = await client.analytics.track({ event: 'product-details-view', product: { key: 'p1' } });

    expect(result).toEqual({ outcomes: [{ provider: 'analytics', outcome: 'accepted' }] });
  });

  it('maps product-summary-view with a search source to search-results-viewed', async () => {
    const { recorder, client } = setup();

    await client.analytics.track({ event: 'product-summary-view', products: [{ key: 'p1' }], source: { type: 'search', identifier: search } });
    await client.analytics.flush();

    expect(recorder.events[0]).toMatchObject({ type: 'search-results-viewed', payload: { search: { term: 'drill' }, products: [{ key: 'p1' }] } });
  });

  it('maps product-summary-view without a source to product-carousel-viewed named unknown', async () => {
    const { recorder, client } = setup();

    await client.analytics.track({ event: 'product-summary-view', products: [{ key: 'p1' }] });
    await client.analytics.flush();

    expect(recorder.events[0]).toMatchObject({ type: 'product-carousel-viewed', payload: { carousel: { carouselName: 'unknown' }, products: [{ key: 'p1' }] } });
  });

  it('maps product-summary-click to product-clicked from the search, or direct without a source', async () => {
    const { recorder, client } = setup();

    await client.analytics.track({ event: 'product-summary-click', product: { key: 'p1' }, position: 3, source: { type: 'search', identifier: search } });
    await client.analytics.track({ event: 'product-summary-click', product: { key: 'p2' }, position: 1 });
    await client.analytics.flush();

    expect(recorder.events.map((e) => e.origin)).toEqual([
      expect.objectContaining({ type: 'search', position: 3, identifier: expect.objectContaining({ term: 'drill' }) }),
      { type: 'direct' },
    ]);
    expect(recorder.events.map((e) => e.type)).toEqual(['product-clicked', 'product-clicked']);
  });

  it('maps product-details-view to product-viewed and purchase to order-placed', async () => {
    const { recorder, client } = setup();
    const order = OrderSchema.parse({
      identifier: { key: 'o1' },
      userId: { userId: 'u1' },
      items: [],
      price: CostBreakDownSchema.parse({}),
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'NotAllocated',
      paymentInstructions: [],
    });

    await client.analytics.track({ event: 'product-details-view', product: { key: 'p1' } });
    await client.analytics.track({ event: 'purchase', order });
    await client.analytics.flush();

    expect(recorder.events.map((e) => e.type)).toEqual(['product-viewed', 'order-placed']);
    expect(recorder.events[1]).toMatchObject({ payload: { order: { identifier: { key: 'o1' } } } });
  });

  it('does not wait on providers', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let delivered = false;
    const slow: AnalyticsSubscriber = {
      name: 'slow',
      types: ['*'],
      purpose: 'necessary',
      async handle() {
        await blocked;
        delivered = true;
      },
    };
    const client = new ClientBuilder(createInitialRequestContext()).withAnalyticsSubscriber(slow).build();

    const result = await client.analytics.track({ event: 'product-details-view', product: { key: 'p1' } });

    expect(result.outcomes[0].outcome).toBe('accepted');
    expect(delivered).toBe(false);
    release();
    await client.analytics.flush();
    expect(delivered).toBe(true);
  });

  it('reports rejected for invalid events and delivers nothing', async () => {
    const { recorder, client } = setup();

    const result = await client.analytics.track({ event: 'product-details-view', product: {} } as never);
    await client.analytics.flush();

    expect(recorder.events).toHaveLength(0);
    expect(result).not.toEqual({ outcomes: [{ provider: 'analytics', outcome: 'accepted' }] });
  });

  it('reports rejected for product-cart-add when the cart capability is not configured', async () => {
    const { recorder, client } = setup();

    const result = await client.analytics.track({ event: 'product-cart-add', product: { key: 'p1' } });
    await client.analytics.flush();

    expect(result).toEqual({ outcomes: [{ provider: 'analytics', outcome: 'rejected' }] });
    expect(recorder.events).toHaveLength(0);
  });

  it('passes a legacy personalization profile on to providers that still read it', async () => {
    class ProfileCapturingProvider extends LegacyAnalyticsProvider {
      public profile: PersonalizationProfile | undefined;
      protected override async processProductDetailsView(event: AnalyticsMutationProductDetailsViewEvent): Promise<AnalyticsResult> {
        this.profile = event.personalizationProfile;
        return this.accepted();
      }
    }
    const requestContext = createInitialRequestContext();
    requestContext.session.marketingContext.identifier.key = 'session-visitor';
    const provider = new ProfileCapturingProvider(new NoOpCache(), requestContext);
    const client = new ClientBuilder(requestContext).withCapability(() => ({ analytics: provider })).build();

    await client.analytics.track({
      event: 'product-details-view',
      product: { key: 'p1' },
      personalizationProfile: { identifier: { key: 'legacy-visitor' }, segments: ['vip'], blurb: '' },
    });
    await client.analytics.flush();

    expect(provider.profile).toMatchObject({ identifier: { key: 'legacy-visitor' }, segments: ['vip'] });
  });
});

describe('emitLegacyAnalyticsEvent product-cart-add', () => {
  function dispatcherWith(capabilities: Parameters<typeof createAnalyticsContext>[0]['capabilities']) {
    const requestContext = createInitialRequestContext();
    const recorder = new RecordingAnalyticsSubscriber();
    const dispatcher = new AnalyticsDispatcher({
      requestContext,
      subscribers: [recorder],
      createContext: () => createAnalyticsContext({ capabilities, requestContext }),
    });
    return { dispatcher, recorder };
  }
  const product = { identifier: { key: 'p1' }, mainVariant: { identifier: { sku: 's-main' } } } as unknown as Product;

  it('resolves the active cart and the main variant sku before emitting cart-item-added', async () => {
    const { dispatcher, recorder } = dispatcherWith({
      cart: { getActiveCartId: async () => success({ key: 'c1' }), getById: async () => success(cart) },
      product: { getById: async () => success(product), getBySKU: vi.fn() },
    });

    const result = await emitLegacyAnalyticsEvent(
      { event: 'product-cart-add', product: { key: 'p1' }, source: { type: 'search', identifier: search } },
      dispatcher,
    );
    await dispatcher.flush();

    expect(result.success).toBe(true);
    expect(recorder.events[0]).toMatchObject({
      type: 'cart-item-added',
      payload: { cart: { identifier: { key: 'c1' } }, variant: { sku: 's-main' }, quantity: 1 },
      origin: { type: 'search', position: 0 },
    });
  });

  it('fails without emitting when the cart cannot be resolved', async () => {
    const { dispatcher, recorder } = dispatcherWith({
      cart: { getActiveCartId: async () => error({ type: 'NotFound', identifier: 'none' }), getById: vi.fn() },
      product: { getById: async () => success(product), getBySKU: vi.fn() },
    });

    const result = await emitLegacyAnalyticsEvent({ event: 'product-cart-add', product: { key: 'p1' } }, dispatcher);
    await dispatcher.flush();

    expect(result.success).toBe(false);
    expect(recorder.events).toHaveLength(0);
  });

  it('fails without emitting when the product cannot be resolved', async () => {
    const { dispatcher, recorder } = dispatcherWith({
      cart: { getActiveCartId: async () => success({ key: 'c1' }), getById: async () => success(cart) },
      product: { getById: async () => error({ type: 'NotFound', identifier: 'p1' }), getBySKU: vi.fn() },
    });

    const result = await emitLegacyAnalyticsEvent({ event: 'product-cart-add', product: { key: 'p1' } }, dispatcher);
    await dispatcher.flush();

    expect(result.success).toBe(false);
    expect(recorder.events).toHaveLength(0);
  });
});
