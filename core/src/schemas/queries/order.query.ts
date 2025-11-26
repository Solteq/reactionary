import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { OrderIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const OrderQueryByIdSchema = BaseQuerySchema.extend({
    order: OrderIdentifierSchema
});

export type OrderQueryById = InferType<typeof OrderQueryByIdSchema>;
