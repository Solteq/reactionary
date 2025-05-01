import { z } from 'zod';

/**
 * TODOS THAT DON'T ACTUALLY BELONG HERE:
 *
 * - Caching story (redis or similar - cross transactional with expiry and cache ids)
 * - Clean up bootstrapping in examples to be idiomatic with language
 * - TRPC example for Angular
 * - Serverside Next example
 */

export const FacetIdentifierSchema = z.interface({
    key: z.string().default('')
});

export const FacetValueIdentifierSchema = z.interface({
    facet: FacetIdentifierSchema.default(FacetIdentifierSchema.parse({})),
    key: z.string().default('')
});

export const ProductIdentifierSchema = z.interface({
    key: z.string().default(''),
});

export const SearchIdentifierSchema = z.interface({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema).default([])
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
