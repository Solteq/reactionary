import { z } from 'zod';
import { BaseModelSchema } from './base.model';

export const InventorySchema = BaseModelSchema.extend({
    quantity: z.number().default(0).describe('Available stock quantity')
}).describe('Inventory information for a product or SKU');

export type Inventory = z.infer<typeof InventorySchema>;