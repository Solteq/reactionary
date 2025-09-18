import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model';

export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    product: ProductIdentifierSchema.nonoptional(),
    quantity: z.number()
});

export const CartMutationItemRemoveSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    item: CartItemIdentifierSchema.nonoptional()
});

export const CartMutationItemQuantityChangeSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    item: CartItemIdentifierSchema.nonoptional(),
    quantity: z.number()
});

export type CartMutationItemAdd = z.infer<typeof CartMutationItemAddSchema>;
export type CartMutationItemRemove = z.infer<typeof CartMutationItemRemoveSchema>;
export type CartMutationItemQuantityChange = z.infer<typeof CartMutationItemQuantityChangeSchema>;