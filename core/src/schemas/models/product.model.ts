import { z } from 'zod';
import { AttributeIdentifierSchema, ProductIdentifierSchema, SKUIdentifierSchema } from './common/identifiers.model';
import { BaseModelSchema } from './common/base.model';
import { ImageSchema } from './common/image.model';

export const ProductAttributeSchema = z.looseInterface({
    identifier: AttributeIdentifierSchema.default(() => AttributeIdentifierSchema.parse({})),
    name: z.string(),
    value: z.string()
});

export const SKUSchema = z.looseInterface({
    identifier: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})).describe('The primary identifier for the sku, used for referencing it across system boundaries.'),
    attributes: z.array(ProductAttributeSchema).default(() => []),
    image: ImageSchema.default(() => ImageSchema.parse({})).nonoptional().describe('The primary image intended for display to the customer when first viewing the SKU. This image will also exist in the images array, and will always be the 0th element in the images array. It is effectively the hero image.'),
    images: ImageSchema.array().default([]).describe('The list of images associated with the product, typically used for displaying a carousel of images.'),
    isHero: z.boolean().default(false).describe('Indicator for whether the SKU is considered the hero variant within the product. A product is expected to have a single hero variant, which is the default selection when the customer is viewing it.')
});

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({}))
        .describe('The primary identifier of the product, used for referencing it across system boundaries.'),
    name: z.string().default('').describe('The display name of the product, typically used as the primary point of display to the end customer.'),
    slug: z.string().default('').describe('The SEO slug of the product, for navigational uses.'),
    description: z.string().default('').describe('The primary textual description of the product, for display purposes.'),
    skus: z.array(SKUSchema).default(() => []).describe('The list of SKUs (purchaseable variants) that exist within the product. These are the items that can actually be added to cart.')
}).describe('The product model is primarily intended for consumption by the PDP page. The Product itself is mostly an aggregation of its SKUs, with additional data for navigation and descriptive purposes. Inventory, prices, variant differences and images all live on the SKUs, of which the primary (default) candidate is identified as the hero SKU.')

export type SKU = z.infer<typeof SKUSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
