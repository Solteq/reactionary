import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    query: z.literal('slug'),
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    query: z.literal('id'),
    id: z.string()
});

export const UnknownQuerySchema = BaseQuerySchema.extend({
    query: z.string()
});

export const ProductQuerySchema = z.union([ProductQueryBySlugSchema, ProductQueryByIdSchema, UnknownQuerySchema]);

export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
