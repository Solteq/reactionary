import type { Session } from '@reactionary/core';

export function createAnonymousTestSession(): Session {
  return {
    id: 'test-session-id',
    identity: {
      type: 'Anonymous',
      meta: {
        cache: { hit: false, key: '' },
        placeholder: false,
      },
      id: { userId: 'anonymous' },
      token: undefined,
      issued: new Date(),
      expiry: new Date(new Date().getTime() + 3600 * 1000),
      logonId: "",
      createdAt: "",
      updatedAt: "",
      keyring: [],
      currentService: undefined
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
