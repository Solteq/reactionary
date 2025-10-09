import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, IdentityIdentifierSchema, ProductIdentifierSchema, SKUIdentifierSchema } from '../models/identifiers.model';
import { BaseModelSchema } from './base.model';
import { MonetaryAmountSchema } from './price.model';
import { AddressSchema } from './profile.model';
import { ShippingMethodSchema } from './shipping-method.model';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model';




export const CartItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
    quantity: z.number().default(0),
    price: ItemCostBreakdownSchema.default(() => ItemCostBreakdownSchema.parse({})),
});

export const CartSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),

    userId: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),

    items: z.array(CartItemSchema).default(() => []),
    price: CostBreakDownSchema.default(() => CostBreakDownSchema.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),


});


export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
