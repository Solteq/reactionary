import { z } from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, SearchIdentifierSchema } from './identifiers.model';
import { BaseModelSchema } from './base.model';
import { ImageSchema } from './product.model';

export const SearchResultProductSchema = z.looseObject({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})).describe('Unique product identifier'),
    name: z.string().default('').describe('Product display name'),
    image: ImageSchema.default(() => ImageSchema.parse({})).describe('Primary product image for search results'),
    slug: z.string().default('').describe('URL-friendly product identifier')
}).describe('Simplified product data for search result display');

export const SearchResultFacetValueSchema = z.looseObject({
    identifier: FacetValueIdentifierSchema.default(() => FacetValueIdentifierSchema.parse({})).describe('Unique identifier for this facet value'),
    name: z.string().default('').describe('Display name for the facet value'),
    count: z.number().default(0).describe('Number of matching products with this facet value'),
    active: z.boolean().default(false).describe('Whether this facet value is currently selected')
}).describe('A selectable value within a search facet with result count');

export const SearchResultFacetSchema = z.looseObject({
    identifier: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})).describe('Unique identifier for this facet'),
    name: z.string().default('').describe('Display name for the facet (e.g., "Brand", "Category")'),
    values: z.array(SearchResultFacetValueSchema).default(() => []).describe('Available values for this facet')
}).describe('A search facet containing filterable values and their counts');

export const SearchResultSchema = BaseModelSchema.extend({
    identifier: SearchIdentifierSchema.default(() => SearchIdentifierSchema.parse({})).describe('The search query that produced these results'),
    products: z.array(SearchResultProductSchema).default(() => []).describe('List of products matching the search criteria'),
    pages: z.number().default(0).describe('Total number of pages available'),
    facets: z.array(SearchResultFacetSchema).default(() => []).describe('Available facets for refining search results')
}).describe('Complete search results including products, pagination, and facets');

export type SearchResultProduct = z.infer<typeof SearchResultProductSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResultFacet = z.infer<typeof SearchResultFacetSchema>;
export type SearchResultFacetValue = z.infer<typeof SearchResultFacetValueSchema>;