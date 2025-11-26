import { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { PaginationOptionsSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/index.js';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string()
});

export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    identifier: ProductIdentifierSchema
});

export const ProductQueryBySKUSchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema,
});

export const ProductQueryVariantsSchema = BaseQuerySchema.extend({
    parentId: ProductIdentifierSchema,
    paginationOptions: PaginationOptionsSchema,
});


export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQueryBySKU = z.infer<typeof ProductQueryBySKUSchema>;
export type ProductQueryVariants = z.infer<typeof ProductQueryVariantsSchema>;
