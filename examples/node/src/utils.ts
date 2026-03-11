import {
  createInitialRequestContext,
  ClientBuilder,
  NoOpCache,
  ProductSearchResultItemSchema,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/commercetools';
import { withCommercetoolsCapabilities } from '@reactionary/commercetools';
import { withAlgoliaCapabilities } from "@reactionary/algolia";
import { withMedusaCapabilities } from '@reactionary/medusa';
import { withMeilisearchCapabilities } from '@reactionary/meilisearch';
import { withFakeCapabilities } from '@reactionary/fake';
import type { FakeConfiguration } from '@reactionary/fake';

export function getAlgoliaTestConfiguration() {
  return {
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
    useRecommendationsForBots: process.env['ALGOLIA_USE_RECOMMENDATIONS_FOR_BOTS'] === 'true',
  };
}

export function getMeilisearchTestConfiguration() {
  return {
    apiKey: process.env['MEILISEARCH_API_KEY'] || '',
    apiUrl: process.env['MEILISEARCH_API_URL'] || '',
    indexName: process.env['MEILISEARCH_INDEX'] || '',
    useAIEmbedding: process.env['MEILISEARCH_USE_AI_EMBEDDING'] || undefined,
    orderIndexName: process.env['MEILISEARCH_ORDER_INDEX'] || 'order',
    useRecommendationsForBots: process.env['MEILISEARCH_USE_RECOMMENDATIONS_FOR_BOTS'] === 'true',
  };
}


export function getMedusaTestConfiguration() {
  return {
        publishable_key: process.env['MEDUSA_PUBLISHABLE_KEY'] || '',
        adminApiKey: process.env['MEDUSA_ADMIN_KEY'] || '',
        apiUrl: process.env['MEDUSA_API_URL'] || '',
        defaultCurrency: process.env['MEDUSA_DEFAULT_CURRENCY'] || '',
        allCurrencies: []
    };
}


export function getFakeConfiguration(): FakeConfiguration {
  return {
    jitter: {
      mean: 0,
      deviation: 0,
    },
    seeds: {
      product: 1,
      search: 1,
      category: 1,
    },
  } satisfies FakeConfiguration;
}

export function getCommercetoolsTestConfiguration() {
  return {
    apiUrl: process.env['CTP_API_URL'] || '',
    authUrl: process.env['CTP_AUTH_URL'] || '',
    clientId: process.env['CTP_CLIENT_ID'] || '',
    clientSecret: process.env['CTP_CLIENT_SECRET'] || '',
    projectKey: process.env['CTP_PROJECT_KEY'] || '',
    scopes: (process.env['CTP_SCOPES'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && x.length > 0),

    paymentMethods: [
      {
        identifier: {
          method: 'stripe',
          name: 'Stripe',
          paymentProcessor: 'stripe'
        },
        isPunchOut: false,
        description: 'Stripe payment gateway',

      },
    ],
    facetFieldsForSearch: (process.env['CTP_FACET_FIELDS_FOR_SEARCH'] || '').split(',') || ['category.id' ]
  } satisfies CommercetoolsConfiguration;
}

export enum PrimaryProvider {
  ALGOLIA = 'Algolia',
  COMMERCETOOLS = 'Commercetools',
  MEDUSA = 'Medusa',
  MEILISEARCH = 'Meilisearch',
  FAKE = 'Fake',
}

export function createClient(provider: PrimaryProvider) {
  const context = createInitialRequestContext();
  let builder = new ClientBuilder(context)
    .withCache(new NoOpCache());

    if (provider === PrimaryProvider.MEDUSA) {
      builder = builder.withCapability(
        withMedusaCapabilities( getMedusaTestConfiguration(), {
          cart: { enabled: true },
          product: { enabled: true },
          category: { enabled: true },
          checkout: { enabled: true },
          identity: { enabled: true },
          inventory: { enabled: true },
          order: { enabled: true },
          price: { enabled: true },
          productSearch: { enabled: true },
          productRecommendations: { enabled: true },
          productAssociations: { enabled: true },
          orderSearch: { enabled: true },
          store: { enabled: true },
          profile: { enabled: true },
        })
      );

      builder = builder.withCapability(multicastProviders( {
        anayltics: true,
        productRecommendations: true, (ProductAssociationIdOnlySchema,  ProductSearchResultItemSchema, ExndedAlgoliaSearchItem )
      }))
    }

    if (provider === PrimaryProvider.FAKE) {
      builder = builder.withCapability(
        withFakeCapabilities( getFakeConfiguration() , {
          price: { enabled: true },
          inventory: { enabled: true },
          product: { enabled: true },
          productReviews: { enabled: true },
          productAssociations: { enabled: true },
        }
      ))
    }

    if (provider === PrimaryProvider.COMMERCETOOLS) {
      builder = builder.withCapability(
        withCommercetoolsCapabilities(getCommercetoolsTestConfiguration(), {
          cart: { enabled: true },
          product: { enabled: true },
          category: { enabled: true },
          checkout: { enabled: true },
          identity: { enabled: true },
          inventory: { enabled: true },
          order: { enabled: true },
          price: { enabled: true },
          productSearch: { enabled: true },
          productAssociations: { enabled: true },
          productReviews: { enabled: true },
          productList: { enabled: true },
          orderSearch: { enabled: true },
          store: { enabled: true },
          profile: { enabled: true },
        })
      );
    }


  if (provider === PrimaryProvider.ALGOLIA) {
    builder = builder.withCapability(
      withAlgoliaCapabilities(getAlgoliaTestConfiguration(), {
        productSearch: { enabled: true },
        productRecommendations: { enabled: true },
      })
    );
  }

  if (provider === PrimaryProvider.MEILISEARCH) {
    builder = builder.withCapability(
      withMeilisearchCapabilities(getMeilisearchTestConfiguration(), {
        productSearch: { enabled: true },
        orderSearch: { enabled: true },
        productRecommendations: { enabled: true },
      }),
    );
    builder = builder.withCapability(
      withMedusaCapabilities(getMedusaTestConfiguration(), {
        cart: { enabled: true },
        identity: { enabled: true },
      })
    );
  }

  return builder.build();
}
