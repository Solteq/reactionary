import * as z from "zod";
import { CategoryIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";
import { PaginationOptionsSchema } from "../models/base.model.js";
import type { InferType } from '../../zod-utils.js';

export const CategoryQueryByIdSchema = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema,
});

export const CategoryQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string(),
});

export const CategoryQueryForBreadcrumbSchema = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema,
});

export const CategoryQueryForChildCategoriesSchema = BaseQuerySchema.extend({
    parentId: CategoryIdentifierSchema,
    paginationOptions: PaginationOptionsSchema,
});

export const CategoryQueryForTopCategoriesSchema = BaseQuerySchema.extend({
    paginationOptions: PaginationOptionsSchema,
});

export type CategoryQueryById = InferType<typeof CategoryQueryByIdSchema>;
export type CategoryQueryBySlug = InferType<typeof CategoryQueryBySlugSchema>;
export type CategoryQueryForBreadcrumb = InferType<typeof CategoryQueryForBreadcrumbSchema>;
export type CategoryQueryForChildCategories = InferType<typeof CategoryQueryForChildCategoriesSchema>;
export type CategoryQueryForTopCategories = InferType<typeof CategoryQueryForTopCategoriesSchema>;
