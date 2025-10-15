import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { OrderIdentifierSchema } from '../models/identifiers.model.js';

export const OrderQueryByIdSchema = BaseQuerySchema.extend({
    order: OrderIdentifierSchema.required()
});

export type OrderQueryById = z.infer<typeof OrderQueryByIdSchema>;
