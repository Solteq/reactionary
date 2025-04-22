import { z } from 'zod';
import { ProductIdentifierSchema, SearchIdentifierSchema } from './identifiers.schema';

export const SearchResultProductSchema = z.object({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400')
});

export const SearchResultSchema = z.object({
    identifier: SearchIdentifierSchema.default(SearchIdentifierSchema.parse({})),
    products: z.array(SearchResultProductSchema).default([]),
    pages: z.number().default(0)
});

export type SearchResultProduct = z.infer<typeof SearchResultProductSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;