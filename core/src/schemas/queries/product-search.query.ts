import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { CategorySchema } from '../models/category.model.js';
import { ProductSearchIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from './base.query.js';

export const ProductSearchQueryByTermSchema = BaseQuerySchema.extend({
    search: ProductSearchIdentifierSchema
});

export const ProductSearchQueryCreateNavigationFilterSchema = z.looseObject({
    categoryPath: z.array(CategorySchema).meta({ description: 'An array representing the breadcrumb path to a category, from root to the specific category.' })
}).meta({ description: 'Payload to create a category navigation filter from a breadcrumb path.' });

export type ProductSearchQueryByTerm = InferType<typeof ProductSearchQueryByTermSchema>;
export type ProductSearchQueryCreateNavigationFilter = InferType<typeof ProductSearchQueryCreateNavigationFilterSchema>;
