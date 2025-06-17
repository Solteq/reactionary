import { z } from 'zod';
import { ProductIdentifierSchema, SearchIdentifierSchema } from './models/identifiers.model';

export const ProductSearchEventSchema = z.looseInterface({
    type: z.literal('search'),
    search: SearchIdentifierSchema,
    products: z.array(ProductIdentifierSchema),
});

export const ProductSearchClickEventSchema = z.looseInterface({
    type: z.literal('product-search-click'),
    search: SearchIdentifierSchema,
    product: ProductIdentifierSchema,
    position: z.number().min(0)
});

export const AnalyticsEventSchema = z.union([ProductSearchEventSchema, ProductSearchClickEventSchema]);

export type ProductSearchEvent = z.infer<typeof ProductSearchEventSchema>;
export type ProductSearchClickEvent = z.infer<typeof ProductSearchClickEventSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
