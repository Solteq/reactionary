import z from "zod";
import { CategoryIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";
import { PaginationOptionsSchema } from "../models/base.model.js";

export const CategoryQueryById = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
});

export const CategoryQueryBySlug = BaseQuerySchema.extend({
    slug: z.string().default(''),
});

export const CategoryQueryForBreadcrumb = BaseQuerySchema.extend({
    id: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
});

export const CategoryQueryForChildCategories = BaseQuerySchema.extend({
    parentId: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});

export const CategoryQueryForTopCategories = BaseQuerySchema.extend({
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});


export type CategoryQueryById = z.infer<typeof CategoryQueryById>;
export type CategoryQueryBySlug = z.infer<typeof CategoryQueryBySlug>;
export type CategoryQueryForBreadcrumb = z.infer<typeof CategoryQueryForBreadcrumb>;
export type CategoryQueryForChildCategories = z.infer<typeof CategoryQueryForChildCategories>;
export type CategoryQueryForTopCategories = z.infer<typeof CategoryQueryForTopCategories>;
