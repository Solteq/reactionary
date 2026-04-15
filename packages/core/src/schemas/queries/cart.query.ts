import { BaseQuerySchema } from './base.query.js';
import { CartIdentifierSchema, CartSearchIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const CartQueryByIdSchema = BaseQuerySchema.extend({
    cart: CartIdentifierSchema
});

export type CartQueryById = InferType<typeof CartQueryByIdSchema>;



export const CartQueryListSchema = BaseQuerySchema.extend({
  search: CartSearchIdentifierSchema
});

export type CartQueryList = InferType<typeof CartQueryListSchema>;
