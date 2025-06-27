import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const InventoryQuerySchema = BaseQuerySchema.extend({
    query: z.literal('sku'),
    sku: z.string()
});

export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;