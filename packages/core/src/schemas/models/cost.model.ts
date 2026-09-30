import * as z from "zod";
import { MonetaryAmountSchema } from "./price.model.js";
import type { InferType } from '../../zod-utils.js';

// TODO: Replace this placeholder with configured/request-context currency defaults.
const EmptyMonetaryAmount = {
    value: 0,
    currency: 'EUR',
} as const;

export const CostBreakDownSchema = z.looseObject({
    totalTax: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The amount of tax paid on the cart. This may include VAT, GST, sales tax, etc.'),
    totalDiscount: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The amount of discount applied to the cart.'),
    totalSurcharge: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The amount of surcharge applied to the cart.'),
    totalShipping: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The amount of shipping fees for the cart.'),
    totalProductPrice: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The total price of products in the cart.'),
    grandTotal: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The total price for the cart including all taxes, discounts, and shipping.'),
});

export const ItemCostBreakdownSchema = z.looseObject({
    unitPrice: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The price per single unit of the item.'),
    unitDiscount: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The discount applied per single unit of the item.'),
    totalPrice: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The total price for all units of the item.'),
    totalDiscount: MonetaryAmountSchema.default(EmptyMonetaryAmount).describe('The total discount applied to all units of the item.'),
});

export type CostBreakDown = InferType<typeof CostBreakDownSchema>;
export type ItemCostBreakdown = InferType<typeof ItemCostBreakdownSchema>;
