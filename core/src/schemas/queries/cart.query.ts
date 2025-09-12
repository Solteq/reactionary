import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { CartIdentifierSchema } from '../models/identifiers.model';

export const CartQueryByIdSchema = BaseQuerySchema.extend({
    cart: CartIdentifierSchema.required()
});
export const CartQuerySchema = z.union([CartQueryByIdSchema]);

export type CartQueryById = z.infer<typeof CartQueryByIdSchema>;