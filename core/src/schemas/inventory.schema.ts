import { z } from 'zod';

export const InventorySchema = z.looseInterface({
    quantity: z.number().default(0)
});

export type Inventory = z.infer<typeof InventorySchema>;