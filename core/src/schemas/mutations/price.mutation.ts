import { z } from 'zod';

export const PriceMutationSchema = z.union([]);

export type PriceMutation = z.infer<typeof PriceMutationSchema>;