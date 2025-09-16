// getBySeoSlug
// getBreadcrumbPathToCategory
// getById
// getByExternalId
// getChildCategories


import { z } from 'zod';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model';
import { CategoryIdentifierSchema } from './identifiers.model';
export const CategorySchema = BaseModelSchema.extend({
    identifier:  CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    text: z.string().default(''),
    images: z.array(ImageSchema.required()).default(() => []),
    parentCategory: CategoryIdentifierSchema.optional(),
});

export type Category = z.infer<typeof CategorySchema>;

export const CategoryPaginatedResultSchema  = createPaginatedResponseSchema(CategorySchema);
export type CategoryPaginatedResult = z.infer<typeof CategoryPaginatedResultSchema>;
