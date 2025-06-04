import { z } from 'zod';
import { ProductIdentifierSchema } from './identifiers.schema';
import { MetaSchema } from './meta.schema';

export const ProductQuerySchema = z.looseInterface({
    slug: z.string(),
    id: z.string(),
}).partial().refine(data => data.id || data.slug, 'Either slug or id must be defined');

export const ProductAttributeSchema = z.looseInterface({
    id: z.string(),
    name: z.string(),
    value: z.string()
});

export const ProductSchema = z.looseInterface({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400'),
    images: z.string().url().array().default(() => []),
    attributes: z.array(ProductAttributeSchema).default(() => []),
    meta: MetaSchema.default(() => MetaSchema.parse({}))
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
