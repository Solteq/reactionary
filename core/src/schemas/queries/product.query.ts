import { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { PaginationOptionsSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/index.js';

export const ProductQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string()
});


export const ProductQueryByIdSchema = BaseQuerySchema.extend({
    identifier: ProductIdentifierSchema.required()
});

export const ProductQueryBySKUSchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
});

export const ProductQueryVariantsSchema = BaseQuerySchema.extend({
    parentId: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});


export type ProductQueryBySlug = z.infer<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = z.infer<typeof ProductQueryByIdSchema>;
export type ProductQueryBySKU = z.infer<typeof ProductQueryBySKUSchema>;
export type ProductQueryVariants = z.infer<typeof ProductQueryVariantsSchema>;
