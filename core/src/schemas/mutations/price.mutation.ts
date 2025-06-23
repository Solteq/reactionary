import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';

export const PriceMutationSchema = z.union([]);

export type PriceMutation = z.infer<typeof PriceMutationSchema>;