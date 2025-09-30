import z from "zod";
import { MonetaryAmountSchema } from "./price.model";

export const CostBreakDownSchema = z.looseObject({
    totalTax: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of tax paid on the cart. This may include VAT, GST, sales tax, etc.'),
    totalDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of discount applied to the cart.'),
    totalSurcharge: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of surcharge applied to the cart.'),
    totalShipping: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of shipping fees for the cart.'),
    totalProductPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price of products in the cart.'),
    grandTotal: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price for the cart including all taxes, discounts, and shipping.'),
});

export const ItemCostBreakdownSchema = z.looseObject({
    unitPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The price per single unit of the item.'),
    unitDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The discount applied per single unit of the item.'),
    totalPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price for all units of the item.'),
    totalDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total discount applied to all units of the item.'),
});

export type CostBreakDown = z.infer<typeof CostBreakDownSchema>;
export type ItemCostBreakdown = z.infer<typeof ItemCostBreakdownSchema>;
