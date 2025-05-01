import { z } from 'zod';
import { ProductIdentifierSchema } from './identifiers.schema';

export const ProductQuerySchema = z.object({
    slug: z.string(),
    id: z.string(),
}).partial().refine(data => data.id || data.slug, 'Either slug or id must be defined');

export const ProductAttributeSchema = z.object({
    id: z.string(),
    name: z.string(),
    value: z.string()
});
 
export const ProductSchema = z.object({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    image: z.string().url().default('https://placehold.co/400'),
    images: z.string().url().array().default([]),
    attributes: z.array(ProductAttributeSchema).default([]),
    status: z.enum(["Retiring", "Active", "Presales"])
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;