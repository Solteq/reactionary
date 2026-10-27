import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  algoliasearch: vi.fn(),
  pushEvents: vi.fn<(arg: { events: unknown[] }) => Promise<void>>(),
  search: vi.fn(),
}));

vi.mock('algoliasearch', () => ({
  algoliasearch: mocks.algoliasearch.mockImplementation(() => ({
    initInsights: () => ({ pushEvents: mocks.pushEvents }),
    search: mocks.search,
  })),
}));

import { AlgoliaAnalyticsCapability } from '../capabilities/analytics.capability.js';
import {
  CartSchema,
  ClientBuilder,
  CostBreakDownSchema,
  NoOpCache,
  OrderSchema,
  ProductCapability,
  createInitialRequestContext,
  error,
  fromDirect,
  fromPDP,
  fromSearch,
  success,
} from '@reactionary/core';
import type { Product, ProductQueryBySKU, RequestContext, Result } from '@reactionary/core';
import { hash } from 'node:crypto';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';

const price = (value: number) => ({
  unitPrice: { currency: 'USD', value },
  totalDiscount: { currency: 'USD', value: 0 },
  totalPrice: { currency: 'USD', value },
  unitDiscount: { currency: 'USD', value: 0 },
});

class StubProductCapability extends ProductCapability {
  constructor(cache: NoOpCache, context: RequestContext, private readonly keysBySku: Record<string, string>) {
    super(cache, context);
  }
  public override async getById(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(payload: ProductQueryBySKU): Promise<Result<Product>> {
    const key = this.keysBySku[payload.variant.sku];
    return key
      ? success({ identifier: { key }, name: key } as unknown as Product)
      : error({ type: 'NotFound', identifier: payload.variant.sku });
  }
}

describe('Algolia analytics provider', async () => {
  const config = {
    apiKey: 'test-api-key',
    appId: 'test-app-id',
    indexName: 'products',
    useRecommendationsForBots: false,
    useBaseIndexNameForEnglishLocale: true,
  } satisfies AlgoliaConfiguration;
  const cache = new NoOpCache();

  mocks.search.mockResolvedValue({
    results: [
      {
        hits: [
          {
            name: 'Test product',
            objectID: 'product-1',
            variants: [{ image: 'https://example.invalid/product.png', sku: 'SKU-1' }],
          },
        ],
        index: 'products',
        nbHits: 1,
        nbPages: 1,
        page: 0,
        queryID: 'query-1',
        hitsPerPage: 10,
        facets: {},
      },
    ],
  });

  const searchContext = createInitialRequestContext();
  const searchFactory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);
  const searchCapability = new AlgoliaProductSearchCapability<typeof searchFactory>(cache, searchContext, config, searchFactory);
  const searchResult = await searchCapability.queryByTerm({
    search: { facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, term: 'q' },
  });
  if (!searchResult.success) {
    throw new Error('Expected the mocked Algolia search to succeed');
  }
  const searchIdentifier = searchResult.value.identifier;

  function setup(configure: (context: RequestContext) => void = () => undefined) {
    const context = createInitialRequestContext();
    configure(context);
    const client = new ClientBuilder(context)
      .withCache(cache)
      .withCapability(() => ({ analytics: new AlgoliaAnalyticsCapability(cache, context, config) }))
      .withCapability(() => ({ product: new StubProductCapability(cache, context, { 'SKU-1': 'product-1', 'SKU-2': 'product-2' }) }))
      .build();
    return { client, context };
  }

  const pushed = () => mocks.pushEvents.mock.calls.flatMap(([arg]) => arg.events);

  const cartWithLine = () =>
    CartSchema.parse({
      identifier: { key: 'cart-1' },
      user: { userId: 'user-1' },
      items: [{ identifier: { key: 'line-1' }, product: { key: 'product-1' }, variant: { sku: 'SKU-1' }, quantity: 2, price: price(25) }],
    });

  beforeEach(() => {
    mocks.pushEvents.mockReset();
    mocks.pushEvents.mockResolvedValue(undefined);
  });

  describe('search results viewed', () => {
    it('sends a view event with the product keys, index and anonymous token', async () => {
      const { client } = setup();

      await client.analytics.searchResultsViewed({ search: searchIdentifier, products: searchResult.value.items.map((x) => x.identifier) });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({
          eventType: 'view',
          index: 'products_da',
          objectIDs: ['product-1'],
          userToken: 'anonymous',
          timestamp: expect.any(Number),
        }),
      ]);
    });

    it('splits more than 20 objects into several events', async () => {
      const { client } = setup();
      const products = Array.from({ length: 25 }, (_, i) => ({ key: `p-${i}` }));

      await client.analytics.searchResultsViewed({ search: searchIdentifier, products });
      await client.analytics.flush();

      expect(pushed().map((e) => (e as { objectIDs: string[] }).objectIDs.length)).toEqual([20, 5]);
    });

    it('sends nothing for zero results', async () => {
      const { client } = setup();

      await client.analytics.searchResultsViewed({ search: searchIdentifier, products: [] });
      await client.analytics.flush();

      expect(mocks.pushEvents).not.toHaveBeenCalled();
    });
  });

  describe('product clicked', () => {
    it('attributes the click to the search query with a 1-based absolute position', async () => {
      const { client } = setup();

      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromSearch(searchIdentifier, 24) });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({ eventType: 'click', objectIDs: ['product-1'], positions: [25], queryID: 'query-1', index: 'products_da' }),
      ]);
    });

    it('looks through a PDP origin to the search that led there', async () => {
      const { client } = setup();

      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromPDP(fromSearch(searchIdentifier, 4)) });
      await client.analytics.flush();

      expect(pushed()).toEqual([expect.objectContaining({ positions: [5], queryID: 'query-1' })]);
    });

    it('sends the plain click event, without query or position, when there is no search or no queryID', async () => {
      const { client } = setup();
      const withoutQueryId = { ...searchIdentifier, key: '' };

      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromDirect() });
      await client.analytics.productClicked({ product: { key: 'product-2' } });
      await client.analytics.productClicked({
        product: { key: 'product-3' },
        origin: fromSearch({ term: 'q', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 } }, 0),
      });
      await client.analytics.productClicked({ product: { key: 'product-4' }, origin: fromSearch(withoutQueryId, 0) });
      await client.analytics.flush();

      expect(pushed()).toHaveLength(4);
      for (const [i, event] of pushed().entries()) {
        expect(event).toMatchObject({ eventType: 'click', objectIDs: [`product-${i + 1}`], index: 'products_da' });
        expect(event).not.toHaveProperty('queryID');
        expect(event).not.toHaveProperty('positions');
      }
    });
  });

  describe('cart item added', () => {
    it('sends an add-to-cart conversion with price, quantity and currency, attributed through the PDP origin', async () => {
      const { client } = setup();

      await client.analytics.cartItemAdded({
        cart: cartWithLine(),
        variant: { sku: 'SKU-1' },
        quantity: 1,
        origin: fromPDP(fromSearch(searchIdentifier, 3)),
      });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({
          eventType: 'conversion',
          eventSubtype: 'addToCart',
          objectIDs: ['product-1'],
          objectData: [{ price: 25, quantity: 1 }],
          currency: 'USD',
          queryID: 'query-1',
        }),
      ]);
    });

    it('sends the plain add-to-cart conversion without a queryID when there is no search origin', async () => {
      const { client } = setup();

      await client.analytics.cartItemAdded({ cart: cartWithLine(), variant: { sku: 'SKU-1' }, quantity: 1, origin: fromDirect() });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({
          eventType: 'conversion',
          eventSubtype: 'addToCart',
          objectIDs: ['product-1'],
          objectData: [{ price: 25, quantity: 1 }],
          currency: 'USD',
        }),
      ]);
      expect(pushed()[0]).not.toHaveProperty('queryID');
    });

    it('sends nothing when the variant is not in the cart', async () => {
      const { client } = setup();

      await client.analytics.cartItemAdded({ cart: cartWithLine(), variant: { sku: 'SKU-9' }, quantity: 1, origin: fromSearch(searchIdentifier, 0) });
      await client.analytics.flush();

      expect(mocks.pushEvents).not.toHaveBeenCalled();
    });
  });

  describe('order placed', () => {
    const order = (skus: string[]) =>
      OrderSchema.parse({
        identifier: { key: 'order-1' },
        userId: { userId: 'user-1' },
        items: skus.map((sku, i) => ({
          identifier: { key: `line-${i}` },
          inventoryStatus: 'Allocated',
          price: price(50),
          quantity: i + 1,
          variant: { sku },
        })),
        price: { ...CostBreakDownSchema.parse({}), grandTotal: { currency: 'USD', value: 150 } },
        orderStatus: 'AwaitingPayment',
        inventoryStatus: 'Allocated',
        paymentInstructions: [],
      });

    it('sends the purchase with product keys resolved from the order SKUs', async () => {
      const { client } = setup();

      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']) });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({
          eventType: 'conversion',
          eventSubtype: 'purchase',
          objectIDs: ['product-1', 'product-2'],
          objectData: [
            { price: 50, quantity: 1 },
            { price: 50, quantity: 2 },
          ],
          currency: 'USD',
          value: 150,
        }),
      ]);
      for (const data of (pushed()[0] as { objectData: object[] }).objectData) {
        expect(data).not.toHaveProperty('queryID');
      }
    });

    it('attributes each purchased object to the search when the order is placed with a search origin', async () => {
      const { client } = setup();

      await client.analytics.orderPlaced({ order: order(['SKU-1', 'SKU-2']), origin: fromPDP(fromSearch(searchIdentifier, 2)) });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({
          eventSubtype: 'purchase',
          objectIDs: ['product-1', 'product-2'],
          objectData: [
            { price: 50, quantity: 1, queryID: 'query-1' },
            { price: 50, quantity: 2, queryID: 'query-1' },
          ],
        }),
      ]);
    });

    it('skips lines whose product cannot be resolved and sends nothing if none can', async () => {
      const { client } = setup();

      await client.analytics.orderPlaced({ order: order(['SKU-1', 'UNKNOWN']) });
      await client.analytics.flush();
      expect(pushed()).toEqual([expect.objectContaining({ objectIDs: ['product-1'], objectData: [{ price: 50, quantity: 1 }] })]);

      mocks.pushEvents.mockClear();
      await client.analytics.orderPlaced({ order: order(['UNKNOWN']) });
      await client.analytics.flush();
      expect(mocks.pushEvents).not.toHaveBeenCalled();
    });
  });

  describe('user tokens', () => {
    it('uses the marketing identifier as userToken and hashes the registered user as authenticatedUserToken', async () => {
      const { client } = setup((context) => {
        context.session.marketingContext.identifier.key = 'visitor-1';
        context.session.identityContext.identity = { type: 'Registered', id: { userId: 'user-1' } };
      });

      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromSearch(searchIdentifier, 0) });
      await client.analytics.flush();

      expect(pushed()).toEqual([expect.objectContaining({ userToken: 'visitor-1', authenticatedUserToken: hash('sha256', 'user-1') })]);
    });

    it('uses the personalization profile passed to the deprecated track as the userToken, and the session id otherwise', async () => {
      const { client } = setup((context) => {
        context.session.marketingContext.identifier.key = 'session-visitor';
      });
      const source = { type: 'search', identifier: searchIdentifier } as const;

      await client.analytics.track({
        event: 'product-summary-click',
        product: { key: 'product-1' },
        position: 0,
        source,
        personalizationProfile: { identifier: { key: 'unomi-profile' }, segments: [], affinities: {}, blurb: '' },
      });
      await client.analytics.track({ event: 'product-summary-click', product: { key: 'product-1' }, position: 0, source });
      await client.analytics.flush();

      expect(pushed()).toEqual([
        expect.objectContaining({ userToken: 'unomi-profile', positions: [1], queryID: 'query-1' }),
        expect.objectContaining({ userToken: 'session-visitor', positions: [1], queryID: 'query-1' }),
      ]);
    });

    it('takes the identity from emit time, not from when the provider was built', async () => {
      const { client, context } = setup();

      context.session.identityContext.identity = { type: 'Registered', id: { userId: 'user-2' } };
      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromSearch(searchIdentifier, 0) });
      await client.analytics.flush();

      expect(pushed()).toEqual([expect.objectContaining({ authenticatedUserToken: hash('sha256', 'user-2') })]);
    });

    it('sends no authenticatedUserToken for anonymous visitors', async () => {
      const { client } = setup();

      await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromSearch(searchIdentifier, 0) });
      await client.analytics.flush();

      expect(pushed()[0]).toMatchObject({ authenticatedUserToken: undefined });
    });
  });

  describe('delivery', () => {
    it('ignores events it has no use for', async () => {
      const { client } = setup();

      await client.analytics.cartViewed({ cart: cartWithLine() });
      await client.analytics.productViewed({ product: { key: 'product-1' } });
      await client.analytics.flush();

      expect(mocks.pushEvents).not.toHaveBeenCalled();
    });

    it('does not surface an Algolia failure to the storefront', async () => {
      const { client } = setup();
      mocks.pushEvents.mockRejectedValue(new Error('algolia down'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await client.analytics.productClicked({ product: { key: 'product-1' }, origin: fromSearch(searchIdentifier, 0) });

      expect(result.success).toBe(true);
      await expect(client.analytics.flush()).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
