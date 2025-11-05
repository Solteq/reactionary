import { describe, expect, it } from 'vitest';
import { ClientBuilder, NoOpCache } from '@reactionary/core';
import { FakeProductProvider, withFakeCapabilities  } from '@reactionary/provider-fake';
import { CommercetoolsCartProvider, withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { AlgoliaSearchProvider, withAlgoliaCapabilities } from '@reactionary/provider-algolia';

describe('client creation', () => {
  it('should be able to mix providers and get a valid, typed client', async () => {
    const client = new ClientBuilder()
      .withCapability(
        withFakeCapabilities(
          {
            jitter: {
              mean: 0,
              deviation: 0,
            },
            seeds: {
              category: 1,
              product: 1,
              search: 1,
            },
          },
          { product: true }
        )
      )
      .withCapability(
        withCommercetoolsCapabilities({
         apiUrl: '',
         authUrl: '',
         clientId: '',
         clientSecret: '',
         paymentMethods: [],
         projectKey: '',
         scopes: []   
        }, { cart: true })
      )
      .withCapability(
        withAlgoliaCapabilities({
            apiKey: '',
            appId: '',
            indexName: ''
        }, { productSearch: true })
      )
      .withCache(new NoOpCache())
      .build();

    expect(client.cart).toBeInstanceOf(CommercetoolsCartProvider);
    expect(client.product).toBeInstanceOf(FakeProductProvider);
    expect(client.productSearch).toBeInstanceOf(AlgoliaSearchProvider);
  });
});
