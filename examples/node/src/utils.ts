import {
  createInitialRequestContext,
  ClientBuilder,
  NoOpCache,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withMedusaCapabilities } from '@reactionary/provider-medusa';

export function getAlgoliaTestConfiguration() {
  return {
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
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
      {
        identifier: {
          method: 'paylater',
          name: 'Pay Later',
          paymentProcessor: 'paylater'
        },
        description: 'Payment that is handled at a later point',
        isPunchOut: false
      }
    ],
    facetFieldsForSearch: (process.env['CTP_FACET_FIELDS_FOR_SEARCH'] || '').split(',') || ['category.id' ]
  } satisfies CommercetoolsConfiguration;
}

export enum PrimaryProvider {
  ALGOLIA = 'Algolia',
  COMMERCETOOLS = 'Commercetools',
  MEDUSA = 'Medusa',
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
          store: true,
          profile: true
        })
      );
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
          store: true,
          profile: true,
        })
      );
    }


  if (provider === PrimaryProvider.ALGOLIA) {
    builder = builder.withCapability(
      withAlgoliaCapabilities(getAlgoliaTestConfiguration(), {
        productSearch: true,
      })
    );
  }

  return builder.build();
}
