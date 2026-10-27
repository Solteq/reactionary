import * as z from 'zod';
import { CategoryIdentifierSchema, ProductAttributeIdentifierSchema, ProductAttributeValueIdentifierSchema, ProductIdentifierSchema, ProductOptionIdentifierSchema, ProductOptionValueIdentifierSchema, ProductTypeIdentifierSchema, ProductVariantIdentifierSchema, ConceptIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, ImageSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';


/**
 * This type represents all the various compliance fields that EU law mandates for products sold within the European Union.
 * It includes information such as the unique identifier for the compliance information.
 */
export const ProductComplianceDataSchema = z.looseObject({
  ce_marking: z.boolean().default(false).meta({ description: 'Indicates whether CE marking can be shown on the product' }),
  weee_symbol: z.boolean().default(false).meta({ description: 'Indicates whether the WEEE symbol can be shown on the product' }),
  energy_class: z.string().optional().meta({ description: 'The energy class of the product, as required by EU regulations. A,B,C,D,E,F,G, etc' }),
  garan_duration: z.number().optional().meta({ description: 'The duration of the guarantee in months as by the EU Garan scheme. Only set if above 24.' }),
  energy_class_range: z.string().optional().meta({ description: 'The scale the energy class belongs to, e.g. "A-G", "A++-G" or "A+++-D". Needed to render the EU class arrow, because the same class letter is drawn differently on different scales.' }),
  eprel_registration_number: z.string().optional().meta({ description: 'The EPREL registration number of the product model (digits only, up to 19). Together with eprel_product_group it identifies the official EU energy label and class arrow.' }),
  eprel_product_group: z.string().optional().meta({ description: 'The EPREL product group URL code the model is registered under, e.g. "spaceheaters" or "localspaceheaters".' }),

  safety_warnings: z.string().optional().meta({ description: 'Any safety warnings associated with the product as required by EU regulations.' }),
  composition: z.string().optional().meta({ description: 'The composition of the product as required by EU regulations.' }),
  additional_disclosures: z.string().optional().meta({ description: 'Any additional disclosures associated with the product as required by EU regulations.' }),

  traceability: z.object({
    product_identifier: z.string().optional().meta({ description: 'The unique identifier for the product batch, e.g., "BATCH-2026-X9".' }),
    manufacturer: z.object({
      name: z.string().optional().meta({ description: 'The name of the manufacturer.' }),
      postal_address: z.string().optional().meta({ description: 'The postal address of the manufacturer.' }),
      electronic_address: z.string().optional().meta({ description: 'The electronic address of the manufacturer.' }),
    }).meta({ description: 'Information about the manufacturer of the product.' }),
    eu_responsible_person: z.object({
      name: z.string().optional().meta({ description: 'The name of the EU responsible person.' }),
      postal_address: z.string().optional().meta({ description: 'The postal address of the EU responsible person.' }),
      electronic_address: z.string().optional().meta({ description: 'The electronic address of the EU responsible person.' }),
    }).meta({ description: 'Information about the EU responsible person for the product.' }),
  }).optional().meta({ description: 'Traceability information for the product as required by EU regulations.' }),


  organic: z.object({
    is_organic: z.boolean().meta({ description: 'true, if the product is organic according to EU regulations.' }),
    certification_type: z.string().optional().meta({ description: 'The type of organic certification, e.g., EU_ORGANIC_LEAF, GOTS, ECOCERT.' }),
    control_body_code: z.string().optional().meta({ description: 'The code of the control body responsible for the certification.' }),
    agriculture_origin: z.string().optional().meta({ description: 'The origin of the agriculture, e.g., EU or non-EU.' }),
    certificate_url: z.url().optional().meta({ description: 'The URL to the organic certification document.' })
  }).optional().meta({ description: 'Information about the organic certification of the product as required by EU regulations.' }),
});

export const ProductOptionValueSchema = z.looseObject({
  identifier: ProductOptionValueIdentifierSchema.describe('The unique identifier for the product option value.'),
  label: z.string().meta({ description: 'The human-friendly label for the product option value.' }),
});

export const ProductOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.describe('The unique identifier for the option.'),
  name: z.string().meta({ description: 'The name of the option, e.g., Size or Color.' }),
  values: z.array(ProductOptionValueSchema).meta({ description: 'A list of possible values for the option.' }),
});

export const ProductVariantOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.describe('The unique identifier for the option.'),
  name: z.string().meta({ description: 'The name of the option, e.g., Size or Color.' }),
  value: ProductOptionValueSchema.describe('The unique identifier for the option value.'),
});

export const ProductVariantSchema = z.looseObject({
    identifier: ProductVariantIdentifierSchema.describe('The unique identifier for the variant. Often its SKU'),
    name: z.string(),
    images: z.array(ImageSchema).meta({ description: 'A list of images associated with the product variant' }),
    ean: z.string().meta({ description: 'The European Article Number identifier for the product variant' }),
    gtin: z.string().meta({ description: 'The Global Trade Item Number identifier for the product variant' }),
    upc: z.string().meta({ description: 'The Universal Product Code identifier for the product variant' }),
    barcode: z.string().meta({ description: 'The barcode identifier for the product variant' }),
    options: z.array(ProductVariantOptionSchema).meta({ description: 'A list of option identifiers that define this variant' }),
});

export const ProductAttributeValueSchema = z.looseObject({
    identifier: ProductAttributeValueIdentifierSchema.describe('The unique identifier for the attribute value.'),
    value: z.string().meta({ description: 'The value of the attribute. Typically a language independent string' }),
    label: z.string().meta({ description: 'The human friendly label for the attribute value. Typically a language dependent string' }),
});



export const ProductAttributeSchema = z.looseObject({
    identifier: ProductAttributeIdentifierSchema.describe('The unique identifier for the attribute, also typically used as the facet key if the attribute is filterable.'),
    group: z.string(),
    name: z.string(),
    unit: z.string().optional().meta({ description: 'The unit sign of the attribute values, e.g. "kg" or "W". Localized where the platform supports it.' }),
    dataType: z.string().optional().meta({ description: 'The data type of the attribute as declared by the product type, e.g. "numeric" or "boolean".' }),
    values: z.array(ProductAttributeValueSchema)
});

/**
 * The product type describes which attributes a product carries. The attribute labels of the product are localized from it.
 */
export const ProductTypeSchema = z.looseObject({
    identifier: ProductTypeIdentifierSchema.describe('The unique identifier of the product type.'),
    name: z.string().meta({ description: 'The localized name of the product type.' }),
});

/**
 * A taxonomy concept assigned to a product, e.g. features/cordless in the vocabulary "features".
 */
export const ProductConceptSchema = z.looseObject({
    identifier: ConceptIdentifierSchema.describe('The unique identifier of the concept, prefixed by its vocabulary.'),
    vocabulary: z.string().meta({ description: 'The vocabulary the concept belongs to, e.g. "features".' }),
    name: z.string().meta({ description: 'The localized name of the concept.' }),
    parent: ConceptIdentifierSchema.optional().meta({ description: 'The parent concept, if the concept is part of a hierarchy.' }),
    notation: z.string().optional().meta({ description: 'A code that identifies the concept within its vocabulary, independent of language.' }),
});

/**
 * Closed list of product flags. Flags are never localized or displayed, they only drive behaviour.
 */
export const ProductFlagSchema = z.enum(['ageRestricted', 'marketingRestricted', 'discontinued', 'professionalUseOnly']);

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema,
    name: z.string().meta({ description: 'The name of the product' }),
    slug: z.string().meta({ description: 'The URL-friendly identifier for the product' }),
    description: z.string().meta({ description: 'A brief description of the product' }),
    longDescription: z.string().meta({ description: 'A detailed description of the product' }),
    brand: z.string().meta({ description: 'The brand associated with the product' }),
    manufacturer: z.string().meta({ description: 'The manufacturer of the product' }),
    parentCategories: z.array(CategoryIdentifierSchema).meta({ description: 'A list of parent categories the product belongs to' }),
    published: z.boolean().meta({ description: 'Indicates whether the product is published and visible to customers' }),
    sharedAttributes: z.array(ProductAttributeSchema).meta({ description: 'A list of technical attributes associated with the product' }),
    options: z.array(ProductOptionSchema).meta({ description: 'A list of options available for the product, such as size or color. Can be empty if product is single-sku' }),
    mainVariant: ProductVariantSchema.describe('The primary SKU for the product'),
    variants: z.array(ProductVariantSchema).default([]).meta({ description: 'A list of all SKUs for the product. Can be empty or omitted if product is single-sku' }),
    complianceData: ProductComplianceDataSchema.optional().describe('Compliance information for the product, including certifications and regulatory markings.'),
    productType: ProductTypeSchema.optional().describe('The product type the product belongs to, if the platform has one.'),
    concepts: z.array(ProductConceptSchema).default([]).meta({ description: 'The taxonomy concepts assigned to the product, across all vocabularies.' }),
    flags: z.array(z.string()).default([]).meta({ description: 'Behavioural flags of the product, see ProductFlagSchema for the known values. Never displayed.' }),
}).describe('A product is a wrapper around sellable items. It contains all the shared information for a set of SKUs. All products have at least one SKU, but can potentially have hundreds.');


export type ProductVariant = InferType<typeof ProductVariantSchema>;
export type Product = InferType<typeof ProductSchema>;
export type ProductComplianceData  = InferType<typeof ProductComplianceDataSchema>;
export type ProductAttribute = InferType<typeof ProductAttributeSchema>;
export type ProductType = InferType<typeof ProductTypeSchema>;
export type ProductConcept = InferType<typeof ProductConceptSchema>;
export type ProductFlag = InferType<typeof ProductFlagSchema>;
export type ProductAttributeValue = InferType<typeof ProductAttributeValueSchema>;
export type ProductOption = InferType<typeof ProductOptionSchema>;
export type ProductOptionValue = InferType<typeof ProductOptionValueSchema>;
export type ProductVariantOption = InferType<typeof ProductVariantOptionSchema>;
