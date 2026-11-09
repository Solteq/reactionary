import * as z from 'zod';

export const UnomiConfigurationSchema = z.looseObject({
  apiUrl: z.string().url(),
  tenantId: z.string().default('default').meta({ description: 'Unomi 4: the tenant id, the user name of the Basic credentials together with `privateKey`.' }),
  privateKey: z.string().optional().meta({ description: 'Unomi 4: the tenant private key. With `tenantId` it makes the sender a trusted caller, which Unomi needs to take a `profileId` from a request, to merge profiles and to read profiles. A sender without it files its events on a throwaway profile per request.' }),
  username: z.string().optional().meta({ description: 'Deprecated, use `tenantId` and `privateKey`. Still honoured as the user name of the Basic credentials when `privateKey` is not set, with `tenantId` as the fallback.' }),
  password: z.string().optional().meta({ description: 'Deprecated, use `privateKey`. Still honoured as the password of the Basic credentials when `privateKey` is not set.' }),
  apiKey: z.string().optional().meta({ description: 'A tenant public key, sent as `X-Unomi-Api-Key`, and also as a bearer token when there are no tenant credentials (Unomi 4 does not take it that way). A public key is not a trusted caller: Unomi ignores the profile id and refuses merges. It does not replace `privateKey`.' }),
  peerKey: z.string().optional().meta({ description: 'Sent as `X-Unomi-Peer`. Only Unomi in single-tenant compatibility mode (and Unomi 3) looks at it, together with the source address, to accept `login` events.' }),
  profilePath: z.string().default('/cxs/profiles'),
  scope: z.string().default('default').meta({ description: 'The Unomi scope of the events, one per storefront.' }),
  sourceId: z.string().default('reactionary').meta({ description: 'The id of the `site` that is the source of the events. It names the sending system.' }),
  fxRatesUrl: z.string().default('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml').meta({ description: 'The ECB daily reference rates, used to add EUR amounts to events. They are cached for a day. An empty string turns the fetch off and leaves `fxFallbackRates`.' }),
  fxFallbackRates: z.record(z.string(), z.number().positive()).default({ DKK: 0.134 }).meta({ description: 'EUR per one unit of a currency, used when the ECB rates cannot be had or lack the currency. The default has only DKK, which is pegged to the euro. A currency with neither gets no EUR amounts.' }),
  shippingPostalAreaDigits: z.record(z.string(), z.int().min(1)).default({ DK: 4, NO: 4, SE: 3, FI: 3 }).meta({ description: 'How many characters of the shipping postal code are sent per country (ISO 3166-1 alpha-2). A country that is not listed sends no postal area, only the country, so a postcode that is nearly an address never leaves by default. The street is never sent.' }),
});

export type UnomiConfiguration = z.infer<typeof UnomiConfigurationSchema>;
/** What a caller passes: the keys with a default can be left out. */
export type UnomiConfigurationInput = z.input<typeof UnomiConfigurationSchema>;
