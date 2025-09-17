import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model';
import { BaseModelSchema } from './base.model';
import { MonetaryAmountSchema } from './price.model';

export const CostBreakDownSchema = z.looseObject({
    totalTax: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of tax paid on the cart. This may include VAT, GST, sales tax, etc.'),
    totalDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of discount applied to the cart.'),
    totalSurcharge: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of surcharge applied to the cart.'),
    totalShipping: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The amount of shipping fees for the cart.'),
    totalProductPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price of products in the cart.'),
    grandTotal: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price for the cart including all taxes, discounts, and shipping.'),
});
export type CostBreakDown = z.infer<typeof CostBreakDownSchema>;

export const ItemCostBreakdownSchema = z.looseObject({
    unitPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The price per single unit of the item.'),
    unitDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The discount applied per single unit of the item.'),
    totalPrice: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total price for all units of the item.'),
    totalDiscount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})).describe('The total discount applied to all units of the item.'),
});

export type ItemCostBreakdown = z.infer<typeof ItemCostBreakdownSchema>;

export const CartItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    quantity: z.number().default(0),
    price: ItemCostBreakdownSchema.default(() => ItemCostBreakdownSchema.parse({})),
});

export const CartSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),
    items: z.array(CartItemSchema).default(() => []),
    price: CostBreakDownSchema.default(() => CostBreakDownSchema.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
