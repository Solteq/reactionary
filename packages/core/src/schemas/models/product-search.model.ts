import * as z from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, ProductSearchIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { ProductVariantOptionSchema } from './product.model.js';
import type { InferType } from '../../zod-utils.js';

export const ProductSearchResultItemComplianceDataSchema = z.looseObject({
    ce_marking: z.boolean().default(false).meta({ description: 'Indicates whether CE marking can be shown on the product' }),
    weee_symbol: z.boolean().default(false).meta({ description: 'Indicates whether the WEEE symbol can be shown on the product' }),
    energy_class: z.string().optional().meta({ description: 'The energy class of the product, as required by EU regulations. A,B,C,D,E,F,G, etc' }),
    garan_label: z.string().optional().meta({ description: 'The duration of the guarantee in months as by the EU Garan scheme. Only set if above 24.' }),
    is_organic: z.boolean().optional().meta({ description: 'Indicates whether the product is organic' }),
    organic_certification_type: z.string().optional().meta({ description: 'The type of organic certification, e.g., EU_ORGANIC_LEAF, GOTS, ECOCERT.' }),
});

export const ProductSearchResultItemVariantSchema = z.looseObject({
    variant: ProductVariantIdentifierSchema.describe('The specific variant of the product'),
    image: ImageSchema.describe('The image representing this variant in the search results'),
    options: ProductVariantOptionSchema.optional().describe('The subset of options that can reasonably be applied on a PLP'),
});

export const ProductSearchResultItemSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema,
    name: z.string(),
    slug: z.string(),
    complianceData: ProductSearchResultItemComplianceDataSchema.optional().meta({ description: 'Compliance data for the product as required by EU regulations.' }),
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
export type ProductSearchResultItemComplianceData = InferType<typeof ProductSearchResultItemComplianceDataSchema>;
export type ProductSearchResult = InferType<typeof ProductSearchResultSchema>;
export type ProductSearchResultFacet = InferType<typeof ProductSearchResultFacetSchema>;
export type ProductSearchResultFacetValue = InferType<typeof ProductSearchResultFacetValueSchema>;
