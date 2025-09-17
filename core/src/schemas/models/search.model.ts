import { z } from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, SearchIdentifierSchema } from './identifiers.model';
import { BaseModelSchema, createPaginatedResponseSchema } from './base.model';
import { create } from 'domain';

export const SearchResultProductSchema = z.looseObject({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400'),
    slug: z.string().default('')
});

export const SearchResultFacetValueSchema = z.looseObject({
    identifier: FacetValueIdentifierSchema.default(() => FacetValueIdentifierSchema.parse({})),
    name: z.string().default(''),
    count: z.number().default(0),
    active: z.boolean().default(false)
});

export const SearchResultFacetSchema = z.looseObject({
    identifier: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    name: z.string().default(''),
    values: z.array(SearchResultFacetValueSchema).default(() => [])
});

export const SearchResultSchema = BaseModelSchema.extend({
    identifier: SearchIdentifierSchema.default(() => SearchIdentifierSchema.parse({})),
    products: z.array(SearchResultProductSchema).default(() => []),
    pages: z.number().default(0),
    facets: z.array(SearchResultFacetSchema).default(() => [])
});


export type SearchResultProduct = z.infer<typeof SearchResultProductSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResultFacet = z.infer<typeof SearchResultFacetSchema>;
export type SearchResultFacetValue = z.infer<typeof SearchResultFacetValueSchema>;
