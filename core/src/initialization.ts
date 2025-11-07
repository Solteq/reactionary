import type { RequestContext } from "./schemas/session.schema.js";

export function createInitialRequestContext(): RequestContext {
  return {
    id: '',
    identity: {
      type: 'Anonymous',
      meta: {
        cache: { hit: false, key: '' },
        placeholder: false,
      },
      id: { userId: 'anonymous-' + crypto.randomUUID().toString() },
      token: undefined,
      issued: new Date(),
      expiry: new Date(new Date().getTime() + 3600 * 1000),
      logonId: '',
      createdAt: '',
      updatedAt: '',
      keyring: [],
      currentService: undefined,
    },
    languageContext: {
      locale: 'en',
      currencyCode: 'USD',
    },
    storeIdentifier: {
      key: 'the-good-store',
    },
    taxJurisdiction: {
      countryCode: 'US',
      stateCode: '',
      countyCode: '',
      cityCode: '',
    },
    session: {},

    correlationId: '',
    isBot: false,
    clientIp: '',
    userAgent: '',
    referrer: '',
  };
}
