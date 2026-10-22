import { describe, expect, it } from 'vitest';
import { NoOpCache } from '../cache/noop-cache.js';
import { ClientBuilder } from '../client/client-builder.js';
import { createInitialRequestContext } from '../initialization.js';
import {
  CartSchema,
  CostBreakDownSchema,
  LegacyAnalyticsProvider,
  OrderSchema,
  fromDirect,
  fromPDP,
  fromSearch,
  searchOriginOf,
} from '../index.js';
import type {
  AnalyticsMutationProductAddToCartEvent,
  AnalyticsMutationProductDetailsViewEvent,
  AnalyticsMutationProductSummaryClickEvent,
  AnalyticsMutationProductSummaryViewEvent,
  AnalyticsMutationPurchaseEvent,
  AnalyticsResult,
  SearchIdentifier,
} from '../index.js';

type Call =
  | { hook: 'summaryView'; event: AnalyticsMutationProductSummaryViewEvent }
  | { hook: 'summaryClick'; event: AnalyticsMutationProductSummaryClickEvent }
  | { hook: 'detailsView'; event: AnalyticsMutationProductDetailsViewEvent }
  | { hook: 'addToCart'; event: AnalyticsMutationProductAddToCartEvent }
  | { hook: 'purchase'; event: AnalyticsMutationPurchaseEvent };

class RecordingLegacyProvider extends LegacyAnalyticsProvider {
  public calls: Call[] = [];

  protected override async processProductSummaryView(event: AnalyticsMutationProductSummaryViewEvent): Promise<AnalyticsResult> {
    this.calls.push({ hook: 'summaryView', event });
    return this.accepted();
  }
  protected override async processProductSummaryClick(event: AnalyticsMutationProductSummaryClickEvent): Promise<AnalyticsResult> {
    this.calls.push({ hook: 'summaryClick', event });
    return this.accepted();
  }
  protected override async processProductDetailsView(event: AnalyticsMutationProductDetailsViewEvent): Promise<AnalyticsResult> {
    this.calls.push({ hook: 'detailsView', event });
    return this.accepted();
  }
  protected override async processProductAddToCart(event: AnalyticsMutationProductAddToCartEvent): Promise<AnalyticsResult> {
    this.calls.push({ hook: 'addToCart', event });
    return this.accepted();
  }
  protected override async processPurchase(event: AnalyticsMutationPurchaseEvent): Promise<AnalyticsResult> {
    this.calls.push({ hook: 'purchase', event });
    return this.accepted();
  }
}

const search: SearchIdentifier = { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };
const cart = CartSchema.parse({
  identifier: { key: 'c1' },
  user: { userId: 'u1' },
  items: [{ identifier: { key: 'i1' }, product: { key: 'product-of-s1' }, variant: { sku: 's1' }, quantity: 2 }],
});

function setup() {
  const requestContext = createInitialRequestContext();
  requestContext.session.marketingContext.identifier.key = 'visitor-1';
  const provider = new RecordingLegacyProvider(new NoOpCache(), requestContext);
  const client = new ClientBuilder(requestContext)
    .withCapability(() => ({ analytics: provider }))
    .build();
  return { provider, client };
}

describe('LegacyAnalyticsProvider', () => {
  it('maps search-results-viewed to a summary view with the search as source', async () => {
    const { provider, client } = setup();

    await client.analytics.searchResultsViewed({ search, products: [{ key: 'p1' }, { key: 'p2' }] });
    await client.analytics.flush();

    expect(provider.calls).toEqual([
      {
        hook: 'summaryView',
        event: expect.objectContaining({
          event: 'product-summary-view',
          products: [{ key: 'p1' }, { key: 'p2' }],
          source: { type: 'search', identifier: search },
          personalizationProfile: expect.objectContaining({ identifier: { key: 'visitor-1' } }),
        }),
      },
    ]);
  });

  it('maps product-carousel-viewed to a summary view without a source', async () => {
    const { provider, client } = setup();

    await client.analytics.productCarouselViewed({ carousel: { carouselName: 'Trending' }, products: [{ key: 'p1' }] });
    await client.analytics.flush();

    expect(provider.calls[0]).toMatchObject({ hook: 'summaryView', event: { products: [{ key: 'p1' }] } });
    expect(JSON.stringify(provider.calls[0].event)).not.toContain('source');
  });

  it('maps product-clicked using the search origin position, also through a PDP upstream', async () => {
    const { provider, client } = setup();

    await client.analytics.productClicked({ product: { key: 'p1' }, origin: fromSearch(search, 24) });
    await client.analytics.productClicked({ product: { key: 'p2' }, origin: fromPDP(fromSearch(search, 7)) });
    await client.analytics.flush();

    expect(provider.calls.map((c) => c.event)).toEqual([
      expect.objectContaining({ event: 'product-summary-click', product: { key: 'p1' }, position: 24, source: { type: 'search', identifier: search } }),
      expect.objectContaining({ event: 'product-summary-click', product: { key: 'p2' }, position: 7, source: { type: 'search', identifier: search } }),
    ]);
  });

  it('maps product-clicked without a search origin to position 0 and no source', async () => {
    const { provider, client } = setup();

    await client.analytics.productClicked({ product: { key: 'p1' }, origin: fromDirect() });
    await client.analytics.flush();

    expect(provider.calls[0].event).toMatchObject({ event: 'product-summary-click', position: 0 });
    expect(JSON.stringify(provider.calls[0].event)).not.toContain('source');
  });

  it('maps product-viewed to a details view', async () => {
    const { provider, client } = setup();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(provider.calls).toEqual([{ hook: 'detailsView', event: expect.objectContaining({ event: 'product-details-view', product: { key: 'p1' } }) }]);
  });

  it('maps cart-item-added to add-to-cart, resolving the product key from the cart line', async () => {
    const { provider, client } = setup();

    await client.analytics.cartItemAdded({ cart, variant: { sku: 's1' }, quantity: 1, origin: fromPDP(fromSearch(search, 3)) });
    await client.analytics.flush();

    expect(provider.calls[0]).toMatchObject({
      hook: 'addToCart',
      event: { event: 'product-cart-add', product: { key: 'product-of-s1' }, source: { type: 'search', identifier: search } },
    });
  });

  it('maps order-placed to a purchase', async () => {
    const { provider, client } = setup();
    const order = OrderSchema.parse({
      identifier: { key: 'o1' },
      userId: { userId: 'u1' },
      items: [],
      price: CostBreakDownSchema.parse({}),
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'NotAllocated',
      paymentInstructions: [],
    });

    await client.analytics.orderPlaced({ order });
    await client.analytics.flush();

    expect(provider.calls[0]).toMatchObject({ hook: 'purchase', event: { event: 'purchase', order: { identifier: { key: 'o1' } } } });
  });

  it('ignores events the legacy API has no equivalent for', async () => {
    const { provider, client } = setup();

    await client.analytics.cartViewed({ cart });
    await client.analytics.custom({ name: 'x', payload: {} });
    await client.analytics.flush();

    expect(provider.calls).toEqual([]);
  });

  it('omits the personalization profile when the visitor has no marketing identifier', async () => {
    const requestContext = createInitialRequestContext();
    const provider = new RecordingLegacyProvider(new NoOpCache(), requestContext);
    const client = new ClientBuilder(requestContext).withCapability(() => ({ analytics: provider })).build();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(provider.calls[0].event.personalizationProfile).toBeUndefined();
  });

  it('keeps the legacy track entry point on the provider itself', async () => {
    const { provider } = setup();

    const result = await provider.track({ event: 'product-details-view', product: { key: 'p1' } });

    expect(result.outcomes).toEqual([{ provider: 'analytics', outcome: 'accepted' }]);
  });

  it('finds the search behind nested origins', () => {
    expect(searchOriginOf(fromPDP(fromPDP(fromSearch(search, 2))))).toMatchObject({ type: 'search', position: 2 });
    expect(searchOriginOf(fromPDP(fromDirect()))).toBeUndefined();
    expect(searchOriginOf(undefined)).toBeUndefined();
  });
});
