import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, IdentityIdentifierSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model.js';
import { BaseModelSchema } from './base.model.js';

export const CartItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
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
