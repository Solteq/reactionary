import { z } from 'zod';
import { BaseModelSchema } from './base.model';
import { PriceIdentifierSchema } from './identifiers.model';
import { CurrencySchema } from './currency.model';

export const MonetaryAmountSchema = z.looseObject({
    value: z.number().default(0).describe('The monetary amount in decimal-precision.'),
    currency: CurrencySchema.default("XXX").describe('The currency associated with the amount, as a ISO 4217 standardized code.')
});

export const TieredPriceSchema = z.looseObject({
    minimumQuantity: z.number().default(0).describe('The minimum quantity required to be eligible for the tiered price.'),
    price: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The monetary amount for the tiered price.'),
});


export const PriceSchema = BaseModelSchema.extend({
    identifier: PriceIdentifierSchema.default(() => PriceIdentifierSchema.parse({})),
    unitPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})),
    tieredPrices: z.array(TieredPriceSchema).default(() => []),
});

export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type TieredPrice = z.infer<typeof TieredPriceSchema>;
