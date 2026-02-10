import type { AnonymousIdentity } from './schemas/index.js';
import type { RequestContext } from './schemas/session.schema.js';

export function createInitialRequestContext(): RequestContext {
  return {
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
    session: {
      identityContext: {
        identity: {
          type: 'Anonymous'
        } satisfies AnonymousIdentity,
        lastUpdated: new Date(),
        personalizationKey: crypto.randomUUID(),
      },
    },
    correlationId: '',
    isBot: false,
    clientIp: '',
    userAgent: '',
    referrer: '',
  };
}
