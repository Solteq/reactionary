import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { ProductIdentifierSchema, ProductSearchIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const AnalyticsMutationSearchEventSchema = BaseMutationSchema.extend({
    mutation: z.literal('search'),
    search: ProductSearchIdentifierSchema,
    products: z.array(ProductIdentifierSchema),
});

export const AnalyticsMutationSearchProductClickEventSchema = BaseMutationSchema.extend({
    mutation: z.literal('product-search-click'),
    search: ProductSearchIdentifierSchema,
    product: ProductIdentifierSchema,
    position: z.number().min(0)
});

export const AnalyticsMutationSchema = z.union([AnalyticsMutationSearchEventSchema, AnalyticsMutationSearchProductClickEventSchema]);

export type AnalyticsMutation = InferType<typeof AnalyticsMutationSchema>;
export type AnalyticsMutationSearchEvent = InferType<typeof AnalyticsMutationSearchEventSchema>;
export type AnalyticsMutationSearchProductClickEvent = InferType<typeof AnalyticsMutationSearchProductClickEventSchema>;
