import { z } from 'zod';
import { BaseModelSchema } from './base.model';
import { PriceIdentifierSchema } from './identifiers.model';
import { CurrencySchema } from './currency.model';

export const MonetaryAmountSchema = z.looseObject({
    cents: z.number().default(0).describe('The monetary amount in cent-precision.'),
    currency: CurrencySchema.default("XXX").describe('The currency associated with the amount, as a ISO 4217 standardized code.')
}).describe('Represents a monetary value with currency and precision');

export const PriceSchema = BaseModelSchema.extend({
    identifier: PriceIdentifierSchema.default(() => PriceIdentifierSchema.parse({})).describe('Identifies which SKU this price applies to'),
    value: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The actual price amount and currency')
}).describe('Pricing information for a specific SKU');

export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;
export type Price = z.infer<typeof PriceSchema>;