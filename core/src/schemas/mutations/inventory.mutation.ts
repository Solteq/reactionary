import { z } from 'zod';

export const InventoryMutationSchema = z.union([]);

export type InventoryMutation = z.infer<typeof InventoryMutationSchema>;