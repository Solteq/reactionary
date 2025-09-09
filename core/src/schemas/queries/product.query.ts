import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    query: z.string(),
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    query: z.string(),
    id: z.string()
});

export const ProductQuerySchema = z.union([BaseQuerySchema, ProductQueryBySlugSchema, ProductQueryByIdSchema]);

export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
