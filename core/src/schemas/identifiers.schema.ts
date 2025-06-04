import { z } from 'zod';

export const FacetIdentifierSchema = z.looseInterface({
    key: z.string().default('')
});

export const FacetValueIdentifierSchema = z.looseInterface({
    facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    key: z.string().default('')
});

export const ProductIdentifierSchema = z.looseInterface({
    key: z.string().default(''),
});

export const SearchIdentifierSchema = z.looseInterface({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema).default(() => [])
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
