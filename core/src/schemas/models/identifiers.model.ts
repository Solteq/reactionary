import { z } from 'zod';

export const FacetIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional().describe('Unique key identifying the facet (e.g., "brand", "category")')
}).describe('Identifies a search facet used for filtering results');

export const FacetValueIdentifierSchema = z.looseObject({
    facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})).describe('The parent facet this value belongs to'),
    key: z.string().default('').nonoptional().describe('Unique key for this facet value (e.g., "nike", "electronics")')
}).describe('Identifies a specific value within a search facet');

export const SKUIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional().describe('Unique SKU code or identifier')
}).describe('Identifies a specific Stock Keeping Unit');

export const ProductIdentifierSchema = z.looseObject({
    key: z.string().default('').describe('Unique product identifier or code'),
}).describe('Identifies a product in the catalog');

export const SearchIdentifierSchema = z.looseObject({
    term: z.string().default('').nonoptional().describe('Search query term or keywords'),
    page: z.number().default(0).nonoptional().describe('Page number for pagination (0-indexed)'),
    pageSize: z.number().default(20).nonoptional().describe('Number of results per page'),
    facets: z.array(FacetValueIdentifierSchema.required()).default(() => []).nonoptional().describe('Active facet filters to apply to search')
}).describe('Identifies a search query with pagination and filters');

export const CartIdentifierSchema = z.looseObject({
    key: z.string().default('').describe('Unique cart identifier or session ID')
}).describe('Identifies a shopping cart or basket');

export const CartItemIdentifierSchema = z.looseObject({
    key: z.string().default('').describe('Unique identifier for a line item in the cart')
}).describe('Identifies a specific item within a shopping cart');

export const PriceIdentifierSchema = z.looseObject({
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})).describe('The SKU this price applies to'),
}).describe('Identifies pricing information for a specific SKU');

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SKUIdentifier = z.infer<typeof SKUIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
export type CartIdentifier = z.infer<typeof CartIdentifierSchema>;
export type CartItemIdentifier = z.infer<typeof CartItemIdentifierSchema>;
export type PriceIdentifier = z.infer<typeof PriceIdentifierSchema>;