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
    onSale: z.boolean().default(false).meta({ description: 'Whether the price is currently discounted. This can be used to indicate if the unitPrice reflects a discount compared to the list price. In B2B the price might differ, due to customer specific pricing, but not necessarily because it is on sale.' }),
    tieredPrices: z.array(TieredPriceSchema)
});

export const PromotionSchema = z.looseObject({
    code: z.string().default('').meta({ description: 'The code for the promotion, if applicable. This can be used to indicate the coupon code used for a promotion, for example.' }),
    isCouponCode: z.boolean().default(false).meta({ description: 'Indicates whether the promotion is a coupon code that the user added himself.' }),
    name: z.string().default('').meta({ description: 'The name of the promotion.' }),
    description: z.string().default('').meta({ description: 'A description of the promotion.' }),
    amount: MonetaryAmountSchema.optional().meta({ description: 'The amount of the promotion, if applicable/available from the source system. This can be used to indicate the discount amount for a promotion, for example.' })  ,
});



export type MonetaryAmount = InferType<typeof MonetaryAmountSchema>;
export type Price = InferType<typeof PriceSchema>;
export type Promotion = InferType<typeof PromotionSchema>;
export type TieredPrice = InferType<typeof TieredPriceSchema>;
