import { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { SKUIdentifierSchema } from '../models/index.js';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    id: z.string()
});

export const ProductQueryBySKUSchema = BaseQuerySchema.extend({
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
});


export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQueryBySKU = z.infer<typeof ProductQueryBySKUSchema>;
