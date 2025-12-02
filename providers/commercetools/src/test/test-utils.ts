import { PaymentMethodSchema, type PaymentMethod, type PaymentMethodIdentifier } from '@reactionary/core';
import { PaymentMethodIdentifierSchema } from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export function getCommercetoolsTestConfiguration() {
  return {
    apiUrl: process.env['CTP_API_URL'] || '',
    authUrl: process.env['CTP_AUTH_URL'] || '',
    clientId: process.env['CTP_CLIENT_ID'] || '',
    clientSecret: process.env['CTP_CLIENT_SECRET'] || '',
    projectKey: process.env['CTP_PROJECT_KEY'] || '',
    scopes: (process.env['CTP_SCOPES'] || '').split(',').map(x => x.trim()).filter(x => x && x.length > 0),

    paymentMethods: [
      PaymentMethodSchema.parse({
        identifier: PaymentMethodIdentifierSchema.parse({
          paymentProcessor: 'stripe',
          method: 'stripe',
          name: 'Stripe',
        } satisfies Partial<PaymentMethodIdentifier>),
        description: 'Stripe payment gateway',
        isPunchOut: true,
      } satisfies Partial<PaymentMethod>),
    ],
    facetFieldsForSearch: []
  } satisfies CommercetoolsConfiguration
}
