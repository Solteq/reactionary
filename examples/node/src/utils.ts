import {
  createInitialRequestContext,
  ClientBuilder,
  NoOpCache,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withMedusaCapabilities } from '@reactionary/provider-medusa';
import { withMeilisearchCapabilities } from '@reactionary/provider-meilisearch';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import type { FakeConfiguration } from '@reactionary/provider-fake';

export function getAlgoliaTestConfiguration() {
  return {
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
  };
}

export function getMeilisearchTestConfiguration() {
  return {
    apiKey: process.env['MEILISEARCH_API_KEY'] || '',
    apiUrl: process.env['MEILISEARCH_API_URL'] || '',
    indexName: process.env['MEILISEARCH_INDEX'] || '',
    useAIEmbedding: process.env['MEILISEARCH_USE_AI_EMBEDDING'] || undefined,
    orderIndexName: process.env['MEILISEARCH_ORDER_INDEX'] || 'order',
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
          cart: true,
          product: true,
          category: true,
          checkout: true,
          identity: true,
          inventory: true,
          order: true,
          price: true,
          productSearch: true,
          productRecommendations: true,
          orderSearch: true,
          store: true,
          profile: true
        })
      );
    }

    if (provider === PrimaryProvider.FAKE) {
      builder = builder.withCapability(
        withFakeCapabilities( getFakeConfiguration() , {
          productReviews: true
        }
      ))
    }

    if (provider === PrimaryProvider.COMMERCETOOLS) {
      builder = builder.withCapability(
        withCommercetoolsCapabilities(getCommercetoolsTestConfiguration(), {
          cart: true,
          product: true,
          category: true,
          checkout: true,
          identity: true,
          inventory: true,
          order: true,
          price: true,
          productSearch: true,
          productReviews: true,
          orderSearch: true,
          store: true,
          profile: true,
        })
      );
    }


  if (provider === PrimaryProvider.ALGOLIA) {
    builder = builder.withCapability(
      withAlgoliaCapabilities(getAlgoliaTestConfiguration(), {
        productSearch: true,
        productRecommendations: true,
      })
    );
  }

  if (provider === PrimaryProvider.MEILISEARCH) {
    builder = builder.withCapability(
      withMeilisearchCapabilities(getMeilisearchTestConfiguration(), {
        productSearch: true,
        orderSearch: true,
        productRecommendations: true,
      }),
    );
    builder = builder.withCapability(
      withMedusaCapabilities(getMedusaTestConfiguration(), {
        cart: true,
        identity: true,
      })
    );
  }

  return builder.build();
}
