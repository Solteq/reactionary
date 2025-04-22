import { z } from 'zod';
import { ProductIdentifierSchema } from './identifiers.schema';

export const ProductAttributeSchema = z.object({
    id: z.string(),
    name: z.string().default(''),
    value: z.string().default('')
});
 
export const ProductSchema = z.object({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400'),
    images: z.string().url().array().default([]),
    attributes: z.array(ProductAttributeSchema).default([])
});

export type Product = z.infer<typeof ProductSchema>;