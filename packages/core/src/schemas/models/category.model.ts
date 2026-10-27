import * as z from 'zod';
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';
import { CategoryIdentifierSchema } from './identifiers.model.js';
import { SeoSchema } from './seo.model.js';
import type { InferType } from '../../zod-utils.js';

export const CategorySchema = BaseModelSchema.extend({
    identifier:  CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    text: z.string().default(''),
    images: z.array(ImageSchema).default(() => []),
    parentCategory: CategoryIdentifierSchema.optional(),
    seo: SeoSchema.optional().describe('Authored SEO metadata for the category page. Only explicitly authored values are set, see resolveSeo for applying fallbacks.'),
});

export type Category = InferType<typeof CategorySchema>;

export const CategoryPaginatedResultSchema  = createPaginatedResponseSchema(CategorySchema);
export type CategoryPaginatedResult = InferType<typeof CategoryPaginatedResultSchema>;
