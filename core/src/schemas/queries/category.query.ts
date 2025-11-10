import { z } from "zod";
import { CategoryIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";
import { PaginationOptionsSchema } from "../models/base.model.js";

export const CategoryQueryByIdSchema = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
});

export const CategoryQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string().default(''),
});

export const CategoryQueryForBreadcrumbSchema = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
});

export const CategoryQueryForChildCategoriesSchema = BaseQuerySchema.extend({
    parentId: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});

export const CategoryQueryForTopCategoriesSchema = BaseQuerySchema.extend({
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});


export type CategoryQueryById = z.infer<typeof CategoryQueryByIdSchema>;
export type CategoryQueryBySlug = z.infer<typeof CategoryQueryBySlugSchema>;
export type CategoryQueryForBreadcrumb = z.infer<typeof CategoryQueryForBreadcrumbSchema>;
export type CategoryQueryForChildCategories = z.infer<typeof CategoryQueryForChildCategoriesSchema>;
export type CategoryQueryForTopCategories = z.infer<typeof CategoryQueryForTopCategoriesSchema>;
