import { describe, it, assert } from 'vitest';
import { AlgoliaAnalyticsProvider } from '../providers/analytics.provider.js';
import { createInitialRequestContext, NoOpCache } from '@reactionary/core';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaProductSearchProvider } from '../providers/product-search.provider.js';

describe('Analytics event tracking', async () => {
  const config = {
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
  } satisfies AlgoliaConfiguration;
  const cache = new NoOpCache();
  const context = createInitialRequestContext();

  const search = new AlgoliaProductSearchProvider(cache, context, config);
  const analytics = new AlgoliaAnalyticsProvider(cache, context, config);
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
    assert.fail();
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
  });
});
