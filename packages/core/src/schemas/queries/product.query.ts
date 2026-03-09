import * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { PaginationOptionsSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/index.js';
import type { InferType } from '../../zod-utils.js';

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


export type ProductQueryBySlug = InferType<typeof ProductQueryBySlugSchema>;
export type ProductQueryById = InferType<typeof ProductQueryByIdSchema>;
export type ProductQueryBySKU = InferType<typeof ProductQueryBySKUSchema>;
export type ProductQueryVariants = InferType<typeof ProductQueryVariantsSchema>;
