import { z } from 'zod';

export const ProductMutationSchema = z.never().describe('No product mutations defined yet');

export type ProductMutation = z.infer<typeof ProductMutationSchema>;