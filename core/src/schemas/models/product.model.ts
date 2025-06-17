import { z } from 'zod';
import { ProductIdentifierSchema } from './identifiers.model';
import { BaseModelSchema } from './base.model';

export const SKUSchema = z.looseInterface({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
});

export const ProductAttributeSchema = z.looseInterface({
    id: z.string(),
    name: z.string(),
    value: z.string()
});

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400'),
    images: z.string().url().array().default(() => []),
    attributes: z.array(ProductAttributeSchema).default(() => []),
    skus: z.array(SKUSchema).default(() => [])
});

export type SKU = z.infer<typeof SKUSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
