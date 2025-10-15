import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { CartIdentifierSchema } from '../models/identifiers.model.js';

export const CartQueryByIdSchema = BaseQuerySchema.extend({
    cart: CartIdentifierSchema.required()
});

export type CartQueryById = z.infer<typeof CartQueryByIdSchema>;