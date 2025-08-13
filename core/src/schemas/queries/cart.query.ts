import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { CartIdentifierSchema } from '../models/common/identifiers.model';

export const CartQueryByIdSchema = BaseQuerySchema.extend({
    query: z.literal('id'),
    cart: CartIdentifierSchema.required()
});
export const CartQuerySchema = z.union([CartQueryByIdSchema]);

export type CartQueryById = z.infer<typeof CartQueryByIdSchema>;
export type CartQuery = z.infer<typeof CartQuerySchema>;
