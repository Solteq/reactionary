import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model';

export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    product: ProductIdentifierSchema.required(),
    quantity: z.number()
});

export const CartMutationItemRemoveSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    item: CartItemIdentifierSchema.required()
});

export const CartMutationItemQuantityChangeSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    item: CartItemIdentifierSchema.required(),
    quantity: z.number()
});

export type CartMutationItemAdd = z.infer<typeof CartMutationItemAddSchema>;
export type CartMutationItemRemove = z.infer<typeof CartMutationItemRemoveSchema>;
export type CartMutationItemQuantityChange = z.infer<typeof CartMutationItemQuantityChangeSchema>;