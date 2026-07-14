import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  algoliasearch: vi.fn(),
  pushEvents: vi.fn(),
  search: vi.fn(),
}));

vi.mock('algoliasearch', () => ({
  algoliasearch: mocks.algoliasearch.mockImplementation(() => ({
    initInsights: () => ({ pushEvents: mocks.pushEvents }),
    search: mocks.search,
  })),
}));

import { AlgoliaAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { createInitialRequestContext, NoOpCache } from '@reactionary/core';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';

describe('Analytics event tracking', async () => {
  const config = {
    apiKey: 'test-api-key',
    appId: 'test-app-id',
    indexName: 'products',
  } satisfies AlgoliaConfiguration;
  const cache = new NoOpCache();
  const context = createInitialRequestContext();

  const searchFactory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);
  const search = new AlgoliaProductSearchCapability<typeof searchFactory>(
    cache,
    context,
    config,
    searchFactory,
  );
  const analytics = new AlgoliaAnalyticsCapability(cache, context, config);

  beforeEach(() => {
    mocks.pushEvents.mockReset();
    mocks.pushEvents.mockResolvedValue(undefined);
  });

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

  const searchResult = await search.queryByTerm({
    search: {
      facets: [],
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
      term: 'q',
    },
  });

  if (!searchResult.success) {
    throw new Error('Expected the mocked Algolia search to succeed');
  }

  it('can track summary clicks', async () => {
    await analytics.track({
      event: 'product-summary-click',
      product: searchResult.value.items[0].identifier,
      position: 1,
      source: {
        type: 'search',
        identifier: searchResult.value.identifier,
      },
    });

    expect(mocks.pushEvents).toHaveBeenCalledTimes(1);
  });

  it('can track summary views', async () => {
    await analytics.track({
      event: 'product-summary-view',
      products: searchResult.value.items.map((x) => x.identifier),
      source: {
        type: 'search',
        identifier: searchResult.value.identifier,
      },
    });

    expect(mocks.pushEvents).toHaveBeenCalledTimes(1);
  });

  it('can track add to cart', async () => {
    await analytics.track({
      event: 'product-cart-add',
      product: searchResult.value.items[0].identifier,
      source: {
        type: 'search',
        identifier: searchResult.value.identifier,
      },
    });

    expect(mocks.pushEvents).toHaveBeenCalledTimes(1);
  });

  it('can track purchase', async () => {
    await analytics.track({
      event: 'purchase',
      order: {
        identifier: {
          key: crypto.randomUUID(),
        },
        inventoryStatus: 'Allocated',
        items: [
          {
            identifier: {
              key: crypto.randomUUID(),
            },
            inventoryStatus: 'Allocated',
            price: {
              unitPrice: {
                currency: 'USD',
                value: 50,
              },
              totalDiscount: {
                currency: 'USD',
                value: 0,
              },
              totalPrice: {
                currency: 'USD',
                value: 50,
              },
              unitDiscount: {
                currency: 'USD',
                value: 0,
              },
            },
            quantity: 1,
            variant: searchResult.value.items[0].variants[0].variant,
          },
        ],
        orderStatus: 'Shipped',
        paymentInstructions: [],
        price: {
          grandTotal: {
            currency: 'USD',
            value: 50,
          },
          totalDiscount: {
            currency: 'USD',
            value: 0,
          },
          totalProductPrice: {
            currency: 'USD',
            value: 50,
          },
          totalShipping: {
            currency: 'USD',
            value: 0,
          },
          totalSurcharge: {
            currency: 'USD',
            value: 0,
          },
          totalTax: {
            currency: 'USD',
            value: 0,
          },
        },
        userId: {
            userId: crypto.randomUUID()
        }
      },
    });

    expect(mocks.pushEvents).toHaveBeenCalledTimes(1);
  });
});
