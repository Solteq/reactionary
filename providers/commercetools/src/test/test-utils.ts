import { Session } from "@reactionary/core";

export function getCommercetoolsTestConfiguration() {
  return {
        apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
        authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
        clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
        clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
        projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || ''
    }
}
export function createAnonymousTestSession(): Session {
  return {
    id: 'test-session-id',
    identity: {
      type: 'Anonymous',
      meta: {
        cache: { hit: false, key: '' },
        placeholder: false,
      },
      id: '',
      token: undefined,
      issued: new Date(),
      expiry: new Date(new Date().getTime() + 3600 * 1000), // 1 hour from now
    },
    languageContext: {
      locale: 'en-US',
      currencyCode: 'USD',
      countryCode: 'US',
    },
    storeIdentifier: {
      key: 'the-good-store',
    },
  };
}
