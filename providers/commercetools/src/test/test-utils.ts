import { Session } from "@reactionary/core";

export function getCommercetoolsTestConfiguration() {
  return {
        apiUrl: process.env['CTP_API_URL'] || '',
        authUrl: process.env['CTP_AUTH_URL'] || '',
        clientId: process.env['CTP_CLIENT_ID'] || '',
        clientSecret: process.env['CTP_CLIENT_SECRET'] || '',
        projectKey: process.env['CTP_PROJECT_KEY'] || '',
        scopes: (process.env['CTP_SCOPES'] || '').split(',').map(x => x.trim()).filter(x => x && x.length > 0),
    }
}
export function createGuestTestSession(): Session {
  const session = createAnonymousTestSession();
  session.identity.type = 'Guest';
  session.identity.id.userId = 'guest-user-id';
  // HOW do i get to call .guest() on the client?

  return session;
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
