import { z } from 'zod';
import { WebStoreIdentifierSchema } from './models/identifiers.model.js';
import { CurrencySchema } from './models/currency.model.js';
import type { InferType } from '../zod-utils.js';

/**
 * The language and locale context for the current request.
 */
export const LanguageContextSchema = z.looseObject( {
    locale: z.string().default('en-US'),
    currencyCode: CurrencySchema.default(() => CurrencySchema.parse({})),
})

export const SessionSchema = z.record( z.string(), z.any());

export const TaxJurisdictionSchema = z.object( {
    countryCode: z.string().default('US'),
    stateCode: z.string().default(''),
    countyCode: z.string().default(''),
    cityCode: z.string().default(''),
});

export const RequestContextSchema = z.looseObject( {
    session: SessionSchema.default(() => SessionSchema.parse({})).describe('Read/Write session storage. Caller is responsible for persisting any changes. Providers will prefix own values'),

    languageContext: LanguageContextSchema.default(() => LanguageContextSchema.parse({})).describe('ReadOnly. The language and locale context for the current request.'),
    storeIdentifier: WebStoreIdentifierSchema.default(() => WebStoreIdentifierSchema.parse({})).describe('ReadOnly. The identifier of the current web store making the request.'),
    taxJurisdiction: TaxJurisdictionSchema.default(() => TaxJurisdictionSchema.parse({})).describe('ReadOnly. The tax jurisdiction for the current request, typically derived from the store location or carts billing address'),

    correlationId: z.string().default('').describe('A unique identifier for the request, can be used for tracing and logging purposes.'),
    isBot: z.boolean().default(false).describe('Indicates if the request is made by a bot or crawler.'),

    clientIp: z.string().default('').describe('The IP address of the client making the request, if available. Mostly for logging purposes'),
    userAgent: z.string().default('').describe('The user agent string of the client making the request, if available.'),
    referrer: z.string().default('').describe('The referrer URL, if available.'),
})



export type Session = InferType<typeof SessionSchema>;
export type LanguageContext = InferType<typeof LanguageContextSchema>;
export type RequestContext = InferType<typeof RequestContextSchema>;
export type TaxJurisdiction = InferType<typeof TaxJurisdictionSchema>;
