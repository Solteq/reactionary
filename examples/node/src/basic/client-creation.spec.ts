import { describe, expect, it } from 'vitest';
import { ClientBuilder, createInitialRequestContext, NoOpCache } from '@reactionary/core';
import { FakeProductCapability, withFakeCapabilities  } from '@reactionary/fake';
import { CommercetoolsCartCapability, withCommercetoolsCapabilities } from '@reactionary/commercetools';
import { AlgoliaProductSearchCapability, withAlgoliaCapabilities } from "@reactionary/algolia";

describe('client creation', () => {
  it('should be able to mix providers and get a valid, typed client', async () => {
    const reqCtx = createInitialRequestContext();
    const client = new ClientBuilder(reqCtx)
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
          { product: { enabled: true } }
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
         scopes: [],
         facetFieldsForSearch: []
        }, { cart: { enabled: true } })
      )
      .withCapability(
        withAlgoliaCapabilities({
            apiKey: '',
            appId: '',
            indexName: '',
            useRecommendationsForBots: false,
        }, { productSearch: { enabled: true } })
      )
      .withCache(new NoOpCache())
      .build();

    expect(client.cart).toBeInstanceOf(CommercetoolsCartCapability);
    expect(client.product).toBeInstanceOf(FakeProductCapability);
    expect(client.productSearch).toBeInstanceOf(AlgoliaProductSearchCapability);
  });
});
