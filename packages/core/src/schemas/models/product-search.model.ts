import * as z from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, ProductSearchIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { ProductVariantOptionSchema } from './product.model.js';
import type { InferType } from '../../zod-utils.js';

export const ProductSearchResultItemVariantSchema = z.looseObject({
    variant: ProductVariantIdentifierSchema.describe('The specific variant of the product'),
    image: ImageSchema.describe('The image representing this variant in the search results'),
    options: ProductVariantOptionSchema.optional().describe('The subset of options that can reasonably be applied on a PLP'),
});

export const ProductSearchResultItemSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema,
    name: z.string(),
    slug: z.string(),
    variants: z.array(ProductSearchResultItemVariantSchema).meta({ description: 'A list of variants associated with the product in the search results. If exactly one is present, you can use add-to-cart directly from PLP. If none are present, you must direct to PDP. If mulitple are present, and no options are set, you must direct to PDP. If multiple are present, and they have options, you can render swatches on PLP and allow customer to flip between variants.' }),
});

export const ProductSearchResultFacetValueSchema = z.looseObject({
    identifier: FacetValueIdentifierSchema,
    name: z.string(),
    count: z.number(),
    active: z.boolean(),
});

export const ProductSearchResultFacetSchema = z.looseObject({
    identifier: FacetIdentifierSchema,
    name: z.string(),
    values: z.array(ProductSearchResultFacetValueSchema),
});

export const ProductSearchResultSchema = createPaginatedResponseSchema(ProductSearchResultItemSchema).extend({
    identifier: ProductSearchIdentifierSchema,
    facets: z.array(ProductSearchResultFacetSchema),
});

export type ProductSearchResultItemVariant = InferType<typeof ProductSearchResultItemVariantSchema>;
export type ProductSearchResultItem = InferType<typeof ProductSearchResultItemSchema>;
export type ProductSearchResult = InferType<typeof ProductSearchResultSchema>;
export type ProductSearchResultFacet = InferType<typeof ProductSearchResultFacetSchema>;
export type ProductSearchResultFacetValue = InferType<typeof ProductSearchResultFacetValueSchema>;
