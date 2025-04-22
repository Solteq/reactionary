import { z } from 'zod';
import { ProductIdentifierSchema } from './identifiers.schema';

export const ProductSchema = z.object({
    identifier: ProductIdentifierSchema.default(ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),
    image: z.string().url().default('https://placehold.co/400')
});

export type Product = z.infer<typeof ProductSchema>;