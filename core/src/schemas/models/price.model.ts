import { z } from 'zod';
import { BaseModelSchema } from './common/base.model';
import { PriceIdentifierSchema } from './common/identifiers.model';
import { CurrencySchema } from './common/currency.model';

export const MonetaryAmountSchema = z.looseInterface({
    cents: z.number().default(0).describe('The monetary amount in cent-precision.'),
    currency: CurrencySchema.default("XXX").describe('The currency associated with the amount, as a ISO 4217 standardized code.')
});

export const PriceSchema = BaseModelSchema.extend({
    identifier: PriceIdentifierSchema.default(() => PriceIdentifierSchema.parse({})),
    value: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({}))
});

export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;
export type Price = z.infer<typeof PriceSchema>;