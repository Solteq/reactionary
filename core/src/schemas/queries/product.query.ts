import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    id: z.string()
});

export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;