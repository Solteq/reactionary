import { Session } from "@reactionary/core";
import { FakeConfiguration } from "../schema/configuration.schema";

export function getFakerTestConfiguration(): FakeConfiguration {
  return {
    jitter: {
      mean: 0,
      deviation: 0,
    },
    seeds: {
      product: 1,
      search: 1,
      category: 1,
    }
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
