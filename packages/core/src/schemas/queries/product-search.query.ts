import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { CategorySchema } from '../models/category.model.js';
import { ProductSearchIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from './base.query.js';
import { PersonalizationProfileSchema } from '../models/personalization-profile.model.js';

export const ProductSearchQueryByTermSchema = BaseQuerySchema.extend({
    search: ProductSearchIdentifierSchema,
    personalizationProfile: PersonalizationProfileSchema.optional().meta({ description: 'The marketing profile of the user performing the search. This can be used to provide personalized search results based on the user\'s segments and other attributes defined in their marketing profile.' }),
});

export const ProductSearchQueryCreateNavigationFilterSchema = z.looseObject({
    categoryPath: z.array(CategorySchema).meta({ description: 'An array representing the breadcrumb path to a category, from root to the specific category.' })
}).meta({ description: 'Payload to create a category navigation filter from a breadcrumb path.' });

export type ProductSearchQueryByTerm = InferType<typeof ProductSearchQueryByTermSchema>;
export type ProductSearchQueryCreateNavigationFilter = InferType<typeof ProductSearchQueryCreateNavigationFilterSchema>;
