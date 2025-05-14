import { z } from 'zod';

export const FacetIdentifierSchema = z.interface({
    key: z.string().default('')
});

export const FacetValueIdentifierSchema = z.interface({
    facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    key: z.string().default('')
});

export const ProductIdentifierSchema = z.interface({
    key: z.string().default(''),
});

export const SearchIdentifierSchema = z.interface({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema).default(() => [])
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
