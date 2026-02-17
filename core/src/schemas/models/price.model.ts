import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { PriceIdentifierSchema } from './identifiers.model.js';
import { CurrencySchema } from './currency.model.js';
import type { InferType } from '../../zod-utils.js';

export const MonetaryAmountSchema = z.looseObject({
    value: z.number().meta({ description: 'The monetary amount in decimal-precision.' }),
    currency: CurrencySchema.describe('The currency associated with the amount, as a ISO 4217 standardized code.')
});

export const TieredPriceSchema = z.looseObject({
    minimumQuantity: z.number().meta({ description: 'The minimum quantity required to be eligible for the tiered price.' }),
    price: MonetaryAmountSchema.describe('The monetary amount for the tiered price.'),
});

export const PriceSchema = BaseModelSchema.extend({
    identifier: PriceIdentifierSchema,
    unitPrice: MonetaryAmountSchema,
    tieredPrices: z.array(TieredPriceSchema)
});

export type MonetaryAmount = InferType<typeof MonetaryAmountSchema>;
export type Price = InferType<typeof PriceSchema>;
export type TieredPrice = InferType<typeof TieredPriceSchema>;
