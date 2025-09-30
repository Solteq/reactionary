import type { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { OrderIdentifierSchema } from '../models/identifiers.model';

export const OrderQueryByIdSchema = BaseQuerySchema.extend({
    order: OrderIdentifierSchema.required()
});

export type OrderQueryById = z.infer<typeof OrderQueryByIdSchema>;
