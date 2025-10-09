import { PaymentMethodSchema } from '@reactionary/core';
import { PaymentMethodIdentifierSchema } from '@reactionary/core';

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
              paymentProvider: 'stripe',
              method: 'stripe',
              name: 'Stripe',
            }),
            description: 'Stripe payment gateway'
          })
        ]
    }
}

