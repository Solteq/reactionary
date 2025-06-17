import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from './models/identifiers.model';

export const CartItemSchema = z.looseInterface({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    quantity: z.number().default(0)
});

export const CartSchema = z.looseInterface({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),
    items: z.array(CartItemSchema).default(() => [])
});

export const CartGetPayloadSchema = z.looseInterface({
    cart: CartIdentifierSchema
});

export const CartItemAddPayloadSchema = z.looseInterface({
    cart: CartIdentifierSchema,
    product: ProductIdentifierSchema,
    quantity: z.number()
});

export const CartItemRemovePayloadSchema = z.looseInterface({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema
});

export const CartItemAdjustPayloadSchema = z.looseInterface({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema,
    quantity: z.number()
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type CartGetPayload = z.infer<typeof CartGetPayloadSchema>;
export type CartItemAddPayload = z.infer<typeof CartItemAddPayloadSchema>;
export type CartItemRemovePayload = z.infer<typeof CartItemRemovePayloadSchema>;
export type CartItemAdjustPayload = z.infer<typeof CartItemAdjustPayloadSchema>;