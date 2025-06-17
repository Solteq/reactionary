import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    type: z.literal('BySlug'),
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    type: z.literal('ById'),
    id: z.string() 
});

export const ProductQuerySchema = z.union([ProductQueryBySlugSchema, ProductQueryByIdSchema]);

export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
