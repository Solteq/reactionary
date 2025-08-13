import { z } from 'zod';
import { BaseModelSchema } from './common/base.model';

export const InventorySchema = BaseModelSchema.extend({
    quantity: z.number().default(0)
});

export type Inventory = z.infer<typeof InventorySchema>;