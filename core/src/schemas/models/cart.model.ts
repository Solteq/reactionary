import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model';
import { BaseModelSchema } from './base.model';

export const CartItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})).describe('Unique identifier for this cart line item'),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})).describe('Reference to the product in this line item'),
    quantity: z.number().default(0).describe('Quantity of the product in the cart')
}).describe('A single line item in a shopping cart');

export const CartSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})).describe('Unique identifier for this cart'),
    items: z.array(CartItemSchema).default(() => []).describe('List of items in the cart')
}).describe('Shopping cart containing products and quantities');

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;