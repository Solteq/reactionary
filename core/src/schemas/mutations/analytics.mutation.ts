import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { ProductIdentifierSchema, SearchIdentifierSchema } from '../models/identifiers.model.js';

export const SearchEventSchema = BaseMutationSchema.extend({
    event: z.literal('search'),
    search: SearchIdentifierSchema.required(),
    products: z.array(ProductIdentifierSchema),
});

export const ProductClickEventSchema = BaseMutationSchema.extend({
    event: z.literal('product-search-click'),
    search: SearchIdentifierSchema.required(),
    product: ProductIdentifierSchema.required(),
    position: z.number().min(0)
});

export const AnalyticsEventSchema = z.discriminatedUnion('event', [SearchEventSchema, ProductClickEventSchema]);

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;