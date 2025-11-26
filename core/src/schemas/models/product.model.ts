import { z } from 'zod';
import { CategoryIdentifierSchema, ProductAttributeIdentifierSchema, ProductAttributeValueIdentifierSchema, ProductIdentifierSchema, ProductOptionIdentifierSchema, ProductOptionValueIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, ImageSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';


export const ProductOptionValueSchema = z.looseObject({
  identifier: ProductOptionValueIdentifierSchema.describe('The unique identifier for the product option value.'),
  label: z.string().describe('The human-friendly label for the product option value.'),
});

export const ProductOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.describe('The unique identifier for the option.'),
  name: z.string().describe('The name of the option, e.g., Size or Color.'),
  values: z.array(ProductOptionValueSchema).describe('A list of possible values for the option.'),
});

export const ProductVariantOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.describe('The unique identifier for the option.'),
  name: z.string().describe('The name of the option, e.g., Size or Color.'),
  value: ProductOptionValueSchema.describe('The unique identifier for the option value.'),
});

export const ProductVariantSchema = z.looseObject({
    identifier: ProductVariantIdentifierSchema.describe('The unique identifier for the variant. Often its SKU'),
    name: z.string(),
    images: z.array(ImageSchema).describe('A list of images associated with the product variant'),
    ean: z.string().describe('The European Article Number identifier for the product variant'),
    gtin: z.string().describe('The Global Trade Item Number identifier for the product variant'),
    upc: z.string().describe('The Universal Product Code identifier for the product variant'),
    barcode: z.string().describe('The barcode identifier for the product variant'),
    options: z.array(ProductVariantOptionSchema).describe('A list of option identifiers that define this variant'),
});

export const ProductAttributeValueSchema = z.looseObject({
    identifier: ProductAttributeValueIdentifierSchema.describe('The unique identifier for the attribute value.'),
    value: z.string().describe('The value of the attribute. Typically a language independent string'),
    label: z.string().describe('The human friendly label for the attribute value. Typically a language dependent string'),
});



export const ProductAttributeSchema = z.looseObject({
    identifier: ProductAttributeIdentifierSchema.describe('The unique identifier for the attribute, also typically used as the facet key if the attribute is filterable.'),
    group: z.string(),
    name: z.string(),
    values: z.array(ProductAttributeValueSchema)
});

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema,
    name: z.string().describe('The name of the product'),
    slug: z.string().describe('The URL-friendly identifier for the product'),
    description: z.string().describe('A brief description of the product'),
    longDescription: z.string().describe('A detailed description of the product'),
    brand: z.string().describe('The brand associated with the product'),
    manufacturer: z.string().describe('The manufacturer of the product'),
    parentCategories: z.array(CategoryIdentifierSchema).describe('A list of parent categories the product belongs to'),
    published: z.boolean().describe('Indicates whether the product is published and visible to customers'),
    sharedAttributes: z.array(ProductAttributeSchema).describe('A list of technical attributes associated with the product'),
    options: z.array(ProductOptionSchema).describe('A list of options available for the product, such as size or color. Can be empty if product is single-sku'),
    mainVariant: ProductVariantSchema.describe('The primary SKU for the product'),
}).describe('A product is a wrapper around sellable items. It contains all the shared information for a set of SKUs. All products have at least one SKU, but can potentially have hundreds.');


export type ProductVariant = InferType<typeof ProductVariantSchema>;
export type Product = InferType<typeof ProductSchema>;
export type ProductAttribute = InferType<typeof ProductAttributeSchema>;
export type ProductAttributeValue = InferType<typeof ProductAttributeValueSchema>;
export type ProductOption = InferType<typeof ProductOptionSchema>;
export type ProductOptionValue = InferType<typeof ProductOptionValueSchema>;
export type ProductVariantOption = InferType<typeof ProductVariantOptionSchema>;
