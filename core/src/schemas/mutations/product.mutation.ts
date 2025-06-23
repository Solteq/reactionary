import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';

export const ProductMutationSchema = z.union([]);

export type ProductMutation = z.infer<typeof ProductMutationSchema>;