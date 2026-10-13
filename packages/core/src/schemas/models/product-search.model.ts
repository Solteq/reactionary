import * as z from 'zod';
import { ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, ProductSearchIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { ProductVariantOptionSchema } from './product.model.js';
import type { InferType } from '../../zod-utils.js';

export const ProductSearchResultItemComplianceDataSchema = z.looseObject({
    ce_marking: z.boolean().default(false).meta({ description: 'Indicates whether CE marking can be shown on the product' }),
    weee_symbol: z.boolean().default(false).meta({ description: 'Indicates whether the WEEE symbol can be shown on the product' }),
    energy_class: z.string().optional().meta({ description: 'The energy class of the product, as required by EU regulations. A,B,C,D,E,F,G, etc' }),
    garan_duration: z.number().optional().meta({ description: 'The duration of the guarantee in months as by the EU Garan scheme. Only set if above 24.' }),
    energy_class_range: z.string().optional().meta({ description: 'The scale the energy class belongs to, e.g. "A-G", "A++-G" or "A+++-D". Needed to render the EU class arrow, because the same class letter is drawn differently on different scales.' }),
    eprel_registration_number: z.string().optional().meta({ description: 'The EPREL registration number of the product model (digits only, up to 19). Together with eprel_product_group it identifies the official EU energy label and class arrow.' }),
    eprel_product_group: z.string().optional().meta({ description: 'The EPREL product group URL code the model is registered under, e.g. "spaceheaters" or "localspaceheaters".' }),
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
