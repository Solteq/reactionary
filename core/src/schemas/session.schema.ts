import { z } from 'zod';
import { IdentitySchema } from './models/identity.model';
import { WebStoreIdentifierSchema } from './models/identifiers.model';
import { CurrencySchema } from './models/currency.model';

export const LanguageContextSchema = z.looseObject( {
    locale: z.string().default('en-US'),
    currencyCode: CurrencySchema.default(() => CurrencySchema.parse({})),
    countryCode: z.string().default('US'),
})

export const SessionSchema = z.looseObject({
    id: z.string(),
    identity: IdentitySchema.default(() => IdentitySchema.parse({})),
    languageContext: LanguageContextSchema.default(() => LanguageContextSchema.parse({})),
    storeIdentifier: WebStoreIdentifierSchema.default(() => WebStoreIdentifierSchema.parse({})),
});

export type Session = z.infer<typeof SessionSchema>;
export type LanguageContext = z.infer<typeof LanguageContextSchema>;
