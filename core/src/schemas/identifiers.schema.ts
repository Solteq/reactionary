import { z } from 'zod';

export const ProductIdentifierSchema = z.object({
    id: z.string().default('')
});

export const SearchIdentifierSchema = z.object({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20)
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;