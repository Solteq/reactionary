import { z } from 'zod';

export const FacetIdentifierSchema = z.object({
    id: z.string().default('')
});

export const FacetValueIdentifierSchema = z.object({
    facet: FacetIdentifierSchema.default(FacetIdentifierSchema.parse({})),
    id: z.string().default('')
});

export const ProductIdentifierSchema = z.object({
    id: z.string().default('')
});

export const SearchIdentifierSchema = z.object({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema).default([])
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;