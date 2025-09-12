import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const InventoryQuerySchema = BaseQuerySchema.extend({
    sku: z.string()
});

export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;