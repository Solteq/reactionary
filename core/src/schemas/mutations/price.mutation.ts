import { z } from 'zod';

export const PriceMutationSchema = z.never().describe('No price mutations defined yet');

export type PriceMutation = z.infer<typeof PriceMutationSchema>;