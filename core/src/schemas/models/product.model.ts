import { z } from 'zod';
import { CategoryIdentifierSchema, ProductAttributeIdentifierSchema, ProductAttributeValueIdentifierSchema, ProductIdentifierSchema, ProductOptionIdentifierSchema, ProductOptionValueIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { BaseModelSchema, ImageSchema } from './base.model.js';


export const ProductOptionValueSchema = z.looseObject({
  identifier: ProductOptionValueIdentifierSchema.default( () => ProductOptionValueIdentifierSchema.parse({})).describe('The unique identifier for the product option value.'),
  label: z.string().describe('The human-friendly label for the product option value.'),
});

export const ProductOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.default( () => ProductOptionIdentifierSchema.parse({})).describe('The unique identifier for the option.'),
  name: z.string().describe('The name of the option, e.g., Size or Color.'),
  values: z.array(ProductOptionValueSchema).default(() => []).describe('A list of possible values for the option.'),
});

export const ProductVariantOptionSchema = z.looseObject({
  identifier: ProductOptionIdentifierSchema.default(() => ProductOptionIdentifierSchema.parse({})).describe('The unique identifier for the option.'),
  name: z.string().describe('The name of the option, e.g., Size or Color.'),
  value: ProductOptionValueSchema.default(() => ProductOptionValueSchema.parse({})).describe('The unique identifier for the option value.'),
});

export const ProductVariantSchema = z.looseObject({
    identifier: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})).describe('The unique identifier for the variant. Often its SKU'),
    name: z.string().default(''),
    images: z.array(ImageSchema).default(() => []).describe('A list of images associated with the product variant'),
    sku: z.string().default('').describe('The stock keeping unit identifier for the product variant'),
    ean: z.string().default('').describe('The European Article Number identifier for the product variant'),
    gtin: z.string().default('').describe('The Global Trade Item Number identifier for the product variant'),
    upc: z.string().default('').describe('The Universal Product Code identifier for the product variant'),
    barcode: z.string().default('').describe('The barcode identifier for the product variant'),
    options: z.array(ProductVariantOptionSchema).default(() => []).describe('A list of option identifiers that define this variant'),
});

export const ProductAttributeValueSchema = z.looseObject({
    identifier: ProductAttributeValueIdentifierSchema.default( () => ProductAttributeValueIdentifierSchema.parse({})).describe('The unique identifier for the attribute value.'),
    value: z.string().default('').describe('The value of the attribute. Typically a language independent string'),
    label: z.string().default('').describe('The human friendly label for the attribute value. Typically a language dependent string'),
});



export const ProductAttributeSchema = z.looseObject({
    identifier: ProductAttributeIdentifierSchema.default( () => ProductAttributeIdentifierSchema.parse({})).describe('The unique identifier for the attribute, also typically used as the facet key if the attribute is filterable.'),
    group: z.string().default(''),
    name: z.string().default(''),
    values: z.array(ProductAttributeValueSchema).default(() => []),
});



export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    name: z.string().default('').describe('The name of the product'),
    slug: z.string().default('').describe('The URL-friendly identifier for the product'),
    description: z.string().default('').describe('A brief description of the product'),
    longDescription: z.string().default('').describe('A detailed description of the product'),
    brand: z.string().default('').describe('The brand associated with the product'),
    manufacturer: z.string().default('').describe('The manufacturer of the product'),
    parentCategories: z.array(CategoryIdentifierSchema).default(() => []).describe('A list of parent categories the product belongs to'),
    published: z.boolean().default(false).describe('Indicates whether the product is published and visible to customers'),
    sharedAttributes: z.array(ProductAttributeSchema).default(() => []).describe('A list of technical attributes associated with the product'),
    options: z.array(ProductOptionSchema).default(() => []).describe('A list of options available for the product, such as size or color. Can be empty if product is single-sku'),
    mainVariant: ProductVariantSchema.default( () => ProductVariantSchema.parse({})).describe('The primary SKU for the product'),
}).describe('A product is a wrapper around sellable items. It contains all the shared information for a set of SKUs. All products have at least one SKU, but can potentially have hundreds.');


export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
export type ProductAttributeValue = z.infer<typeof ProductAttributeValueSchema>;
export type ProductOption = z.infer<typeof ProductOptionSchema>;
export type ProductOptionValue = z.infer<typeof ProductOptionValueSchema>;
export type ProductVariantOption = z.infer<typeof ProductVariantOptionSchema>;
