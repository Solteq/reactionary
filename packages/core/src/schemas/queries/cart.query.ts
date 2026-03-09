import { BaseQuerySchema } from './base.query.js';
import { CartIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const CartQueryByIdSchema = BaseQuerySchema.extend({
    cart: CartIdentifierSchema
});

export type CartQueryById = InferType<typeof CartQueryByIdSchema>;