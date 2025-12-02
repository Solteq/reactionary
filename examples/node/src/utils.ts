import {
  createInitialRequestContext,
  ClientBuilder,
  NoOpCache,
  type PaymentMethod,
  type PaymentMethodIdentifier,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';

export function getAlgoliaTestConfiguration() {
  return {
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
  };
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
        meta: {
          cache: {
            hit: false,
            key: ''
          },
          placeholder: false
        },
        description: 'Stripe payment gateway',

      },
    ],
    facetFieldsForSearch: (process.env['CTP_FACET_FIELDS_FOR_SEARCH'] || '').split(',') || ['category.id' ]
  } satisfies CommercetoolsConfiguration;
}

export enum PrimaryProvider {
  ALGOLIA = 'Algolia',
  COMMERCETOOLS = 'Commercetools',
}

export function createClient(provider: PrimaryProvider) {
  const context = createInitialRequestContext();
  let builder = new ClientBuilder(context)
    .withCache(new NoOpCache())
    .withCapability(
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
        store: true,
        profile: true,
      })
    );

  if (provider === PrimaryProvider.ALGOLIA) {
    builder = builder.withCapability(
      withAlgoliaCapabilities(getAlgoliaTestConfiguration(), {
        productSearch: true,
      })
    );
  }

  return builder.build();
}
