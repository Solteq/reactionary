import { z } from 'zod';

export const SearchMutationSchema = z.union([]);

export type SearchMutation = z.infer<typeof SearchMutationSchema>;