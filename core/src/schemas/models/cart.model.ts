import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model';
import { BaseModelSchema } from './base.model';

export const CartItemSchema = z.looseInterface({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    quantity: z.number().default(0)
});

export const CartSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),
    items: z.array(CartItemSchema).default(() => [])
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;