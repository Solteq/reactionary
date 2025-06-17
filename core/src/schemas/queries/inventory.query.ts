import { z } from 'zod';

export const InventoryQuerySchema = z.looseInterface({
    sku: z.string()
});

export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;