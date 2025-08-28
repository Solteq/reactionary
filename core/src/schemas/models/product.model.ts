import { z } from 'zod';
import { ProductIdentifierSchema, SKUIdentifierSchema } from './identifiers.model';
import { BaseModelSchema } from './base.model';

export const ImageSchema = z.looseObject({
    url: z.string().url().default('https://placehold.co/400x400').describe('The URL of the image'),
    title: z.string().default('Placeholder image').describe('Alt text or title for the image'),
    height: z.number().default(400).describe('Height of the image in pixels'),
    width: z.number().default(400).describe('Width of the image in pixels')
}).describe('Represents an image asset with dimensions and metadata');

export const SelectionAttributeSchema = z.looseObject({
    id: z.string().describe('Unique identifier for the attribute'),
    name: z.string().describe('Display name of the attribute (e.g., "Color", "Size")'),
    value: z.string().describe('The value of the attribute (e.g., "Red", "Large")')
}).describe('Attributes used for product variant selection (e.g., color, size, material)');

export const TechnicalSpecificationSchema = z.looseObject({
    id: z.string().describe('Unique identifier for the specification'),
    name: z.string().describe('Name of the technical specification (e.g., "Weight", "Dimensions")'),
    value: z.string().describe('The value of the specification (e.g., "2.5 kg", "30x20x10 cm")')
}).describe('Technical specifications and detailed product information for reference');

export const SKUSchema = z.looseObject({
    identifier: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})).describe('Unique identifier for the SKU'),
    image: ImageSchema.default(() => ImageSchema.parse({})).describe('Primary image for this SKU'),
    images: z.array(ImageSchema).default(() => []).describe('Gallery of additional images for this SKU'),
    selectionAttributes: z.array(SelectionAttributeSchema).default(() => []).describe('Variant-defining attributes like color or size'),
    technicalSpecifications: z.array(TechnicalSpecificationSchema).default(() => []).describe('Detailed technical specifications for this SKU'),
    isHero: z.boolean().default(false).describe('Whether this SKU should be featured prominently')
}).describe('Stock Keeping Unit - represents a specific product variant with its own inventory and pricing');

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})).describe('Unique identifier for the product'),
    name: z.string().default('').describe('Display name of the product'),
    slug: z.string().default('').describe('URL-friendly version of the product name'),
    description: z.string().default('').describe('Detailed product description or marketing copy'),
    skus: z.array(SKUSchema).default(() => []).describe('List of SKUs (variants) available for this product')
}).describe('Represents a product with its variants, images, and specifications');

export type Image = z.infer<typeof ImageSchema>;
export type SKU = z.infer<typeof SKUSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type SelectionAttribute = z.infer<typeof SelectionAttributeSchema>;
export type TechnicalSpecification = z.infer<typeof TechnicalSpecificationSchema>;
