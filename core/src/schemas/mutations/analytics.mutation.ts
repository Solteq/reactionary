import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { ProductIdentifierSchema, ProductSearchIdentifierSchema } from '../models/identifiers.model.js';

export const AnalyticsMutationSearchEventSchema = BaseMutationSchema.extend({
    mutation: z.literal('search'),
    search: ProductSearchIdentifierSchema.required(),
    products: z.array(ProductIdentifierSchema),
});

export const AnalyticsMutationSearchProductClickEventSchema = BaseMutationSchema.extend({
    mutation: z.literal('product-search-click'),
    search: ProductSearchIdentifierSchema.required(),
    product: ProductIdentifierSchema.required(),
    position: z.number().min(0)
});

export const AnalyticsMutationSchema = z.union([AnalyticsMutationSearchEventSchema, AnalyticsMutationSearchProductClickEventSchema]);

export type AnalyticsMutation = z.infer<typeof AnalyticsMutationSchema>;
export type AnalyticsMutationSearchEvent = z.infer<typeof AnalyticsMutationSearchEventSchema>;
export type AnalyticsMutationSearchProductClickEvent = z.infer<typeof AnalyticsMutationSearchProductClickEventSchema>;
