import * as z from 'zod';
import { ConceptIdentifierSchema, ProductIdentifierSchema, FacetValueIdentifierSchema, FacetIdentifierSchema, ProductSearchIdentifierSchema, ProductVariantIdentifierSchema, SearchRangeSchema, StoreIdentifierSchema } from './identifiers.model.js';
import { CurrencySchema } from './currency.model.js';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { ProductConceptSchema, ProductTypeSchema, ProductVariantOptionSchema } from './product.model.js';
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
    productType: ProductTypeSchema.optional().meta({ description: 'The product type of the product, if the search provider indexes it.' }),
    concepts: z.array(ProductConceptSchema).optional().meta({ description: 'The taxonomy concepts of the product, if the search provider indexes them.' }),
    relevance: z.number().min(0).max(1).optional().meta({ description: 'How well the search engine matched the product to the search, 0 to 1, when the provider gets it from the engine. Reordering by the interests of the visitor starts from it.' }),
    canAddToCartDirectly: z.boolean().default(false).meta({ description: 'Whether the storefront may render an add-to-cart button for this product directly on a PLP. When false, the customer must always visit the PDP first, e.g. for regulatory reasons or as a business decision. Set by the indexer where the search provider supports it; otherwise providers default it to true only when the product has exactly one variant.' }),
    variants: z.array(ProductSearchResultItemVariantSchema).meta({ description: 'A list of variants associated with the product in the search results. If exactly one is present, you can use add-to-cart directly from PLP. If none are present, you must direct to PDP. If mulitple are present, and no options are set, you must direct to PDP. If multiple are present, and they have options, you can render swatches on PLP and allow customer to flip between variants.' }),
});

export const ProductSearchResultFacetValueSchema = z.looseObject({
    identifier: FacetValueIdentifierSchema,
    name: z.string(),
    count: z.number(),
    active: z.boolean(),
});

export const ProductSearchResultFacetStatsSchema = z.looseObject({
    min: z.number().meta({ description: 'The lowest value of the facet.' }),
    max: z.number().meta({ description: 'The highest value of the facet.' }),
});

export const ProductSearchResultAttributeFacetSchema = z.looseObject({
    semantic: z.literal('attribute'),
    identifier: FacetIdentifierSchema,
    name: z.string(),
    multiselect: z.boolean().default(false).meta({ description: 'Whether the values widen each other (any of the selected values matches) and the facet keeps offering the values it would without its own selection. Set by the provider configuration.' }),
    values: z.array(ProductSearchResultFacetValueSchema),
    stats: ProductSearchResultFacetStatsSchema.optional().meta({ description: 'The lowest and highest value of a numeric facet, when the provider knows them. With ranges in the search, those of the search without its ranges.' }),
}).meta({ description: 'A plain attribute of the products, selected with the facets of the search.' });

export const ProductSearchResultTaxonomyFacetValueSchema = z.looseObject({
    concept: ConceptIdentifierSchema,
    name: z.string(),
    count: z.number(),
    active: z.boolean(),
});

export const ProductSearchResultTaxonomyFacetSchema = z.looseObject({
    semantic: z.literal('taxonomy'),
    vocabulary: z.string().meta({ description: 'The vocabulary the concepts belong to, e.g. "features".' }),
    name: z.string(),
    multiselect: z.boolean().default(true).meta({ description: 'Always true: concepts of a vocabulary widen each other, and the facet keeps offering the other concepts.' }),
    values: z.array(ProductSearchResultTaxonomyFacetValueSchema),
}).meta({ description: 'The concepts of one vocabulary. Selecting one adds it to the conceptFilter of the search.' });

export const ProductSearchResultPriceFacetSchema = z.looseObject({
    semantic: z.literal('price'),
    name: z.string(),
    multiselect: z.boolean().default(false),
    currency: CurrencySchema.describe('The currency of the amounts.'),
    stats: ProductSearchResultFacetStatsSchema.optional().meta({ description: 'The lowest and highest price in decimal amounts, of the search without its priceFilter, so that a slider keeps its bounds.' }),
    selected: SearchRangeSchema.optional().meta({ description: 'The price range of the search, when it has a priceFilter.' }),
}).meta({ description: 'The price of the products. Selecting a range sets the priceFilter of the search.' });

export const ProductSearchResultRatingFacetBucketSchema = z.looseObject({
    min: z.number().meta({ description: 'The lowest rating of the bucket in whole stars, inclusive.' }),
    max: z.number().meta({ description: 'The highest rating of the bucket in whole stars, inclusive. The same as min for a single star.' }),
    count: z.number(),
    active: z.boolean(),
});

export const ProductSearchResultRatingFacetSchema = z.looseObject({
    semantic: z.literal('rating'),
    name: z.string(),
    multiselect: z.boolean().default(false),
    buckets: z.array(ProductSearchResultRatingFacetBucketSchema),
}).meta({ description: 'The average rating of the products in whole stars. Selecting buckets sets the ratingFilter of the search.' });

export const ProductSearchResultAvailabilityFacetStoreSchema = z.looseObject({
    store: StoreIdentifierSchema,
    name: z.string().optional().meta({ description: 'The name of the store, when the provider knows it.' }),
    count: z.number(),
    active: z.boolean(),
});

export const ProductSearchResultAvailabilityFacetSchema = z.looseObject({
    semantic: z.literal('availability'),
    name: z.string(),
    multiselect: z.boolean().default(true).meta({ description: 'Always true: online and the stores widen each other.' }),
    online: z.looseObject({ count: z.number(), active: z.boolean() }).optional().meta({ description: 'The products that can be bought online.' }),
    stores: z.array(ProductSearchResultAvailabilityFacetStoreSchema).meta({ description: 'The stores that have products in stock.' }),
}).meta({ description: 'Where the products are available. Selecting sets the availabilityFilter of the search.' });

export const ProductSearchResultFacetSchema = z.discriminatedUnion('semantic', [
    ProductSearchResultAttributeFacetSchema,
    ProductSearchResultTaxonomyFacetSchema,
    ProductSearchResultPriceFacetSchema,
    ProductSearchResultRatingFacetSchema,
    ProductSearchResultAvailabilityFacetSchema,
]).meta({ description: 'A facet of the search, in the order the storefront should show them. The semantic tells what the facet is, and which field of the search a selection goes to.' });

export const ProductSearchResultSchema = createPaginatedResponseSchema(ProductSearchResultItemSchema).extend({
    identifier: ProductSearchIdentifierSchema,
    facets: z.array(ProductSearchResultFacetSchema),
});

export type ProductSearchResultItemVariant = InferType<typeof ProductSearchResultItemVariantSchema>;
export type ProductSearchResultItem = InferType<typeof ProductSearchResultItemSchema>;
export type ProductSearchResultItemComplianceData = InferType<typeof ProductSearchResultItemComplianceDataSchema>;
export type ProductSearchResult = InferType<typeof ProductSearchResultSchema>;
export type ProductSearchResultFacet = InferType<typeof ProductSearchResultFacetSchema>;
export type ProductSearchResultAttributeFacet = InferType<typeof ProductSearchResultAttributeFacetSchema>;
export type ProductSearchResultTaxonomyFacet = InferType<typeof ProductSearchResultTaxonomyFacetSchema>;
export type ProductSearchResultTaxonomyFacetValue = InferType<typeof ProductSearchResultTaxonomyFacetValueSchema>;
export type ProductSearchResultPriceFacet = InferType<typeof ProductSearchResultPriceFacetSchema>;
export type ProductSearchResultRatingFacet = InferType<typeof ProductSearchResultRatingFacetSchema>;
export type ProductSearchResultRatingFacetBucket = InferType<typeof ProductSearchResultRatingFacetBucketSchema>;
export type ProductSearchResultAvailabilityFacet = InferType<typeof ProductSearchResultAvailabilityFacetSchema>;
export type ProductSearchResultAvailabilityFacetStore = InferType<typeof ProductSearchResultAvailabilityFacetStoreSchema>;
export type ProductSearchResultFacetValue = InferType<typeof ProductSearchResultFacetValueSchema>;
export type ProductSearchResultFacetStats = InferType<typeof ProductSearchResultFacetStatsSchema>;
