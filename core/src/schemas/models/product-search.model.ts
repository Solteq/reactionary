import { z } from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, ProductSearchIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { ProductVariantOptionSchema } from './product.model.js';


export const ProductSearchResultItemVariantSchema = z.looseObject({
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})).describe('The specific variant of the product'),
    image: ImageSchema.default(() => ImageSchema.parse({})).describe('The image representing this variant in the search results'),
    options: ProductVariantOptionSchema.optional().describe('The subset of options that can reasonably be applied on a PLP'),
});

export const ProductSearchResultItemSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    variants: z.array(ProductSearchResultItemVariantSchema).default(() => []).describe('A list of variants associated with the product in the search results. If exactly one is present, you can use add-to-cart directly from PLP. If none are present, you must direct to PDP. If mulitple are present, and no options are set, you must direct to PDP. If multiple are present, and they have options, you can render swatches on PLP and allow customer to flip between variants.'),
});

export const ProductSearchResultFacetValueSchema = z.looseObject({
    identifier: FacetValueIdentifierSchema.default(() => FacetValueIdentifierSchema.parse({})),
    name: z.string().default(''),
    count: z.number().default(0),
    active: z.boolean().default(false)
});

export const ProductSearchResultFacetSchema = z.looseObject({
    identifier: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    name: z.string().default(''),
    values: z.array(ProductSearchResultFacetValueSchema).default(() => [])
});

export const ProductSearchResultSchema = createPaginatedResponseSchema(ProductSearchResultItemSchema).extend({
    identifier: ProductSearchIdentifierSchema.default(() => ProductSearchIdentifierSchema.parse({})),
    facets: z.array(ProductSearchResultFacetSchema).default(() => [])
});


export type ProductSearchResultItemVariant = z.infer<typeof ProductSearchResultItemVariantSchema>;
export type ProductSearchResultItem = z.infer<typeof ProductSearchResultItemSchema>;
export type ProductSearchResult = z.infer<typeof ProductSearchResultSchema>;
export type ProductSearchResultFacet = z.infer<typeof ProductSearchResultFacetSchema>;
export type ProductSearchResultFacetValue = z.infer<typeof ProductSearchResultFacetValueSchema>;
