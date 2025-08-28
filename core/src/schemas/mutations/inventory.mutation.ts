import { z } from 'zod';

export const InventoryMutationSchema = z.never().describe('No inventory mutations defined yet');

export type InventoryMutation = z.infer<typeof InventoryMutationSchema>;