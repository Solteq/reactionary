import {
  PaymentMethodSchema,
  PaymentMethodIdentifierSchema,
  createInitialRequestContext,
  ClientBuilder,
  NoOpCache,
} from '@reactionary/core';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

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
      PaymentMethodSchema.parse({
        identifier: PaymentMethodIdentifierSchema.parse({
          paymentProvider: 'stripe',
          method: 'stripe',
          name: 'Stripe',
        }),
        description: 'Stripe payment gateway',
      }),
    ],
  };
}

export function createClient() {
  const context = createInitialRequestContext();
  const builder = new ClientBuilder(context);
  const client = builder.withCache(new NoOpCache()).withCapability(
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
      profile: true
    })
  );

  return client.build();
}
