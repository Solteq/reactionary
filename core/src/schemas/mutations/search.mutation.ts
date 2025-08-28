import { z } from 'zod';

export const SearchMutationSchema = z.never().describe('No search mutations defined yet');

export type SearchMutation = z.infer<typeof SearchMutationSchema>;