import { z } from 'zod';

export const ProductMutationSchema = z.union([]);

export type ProductMutation = z.infer<typeof ProductMutationSchema>;