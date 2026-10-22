import * as z from 'zod';
import type { InferType } from '../../../../zod-utils.js';
import {
    AnalyticsAutocompleteSuggestionSchema,
    AnalyticsCarouselSchema,
    AnalyticsCategoryRefSchema,
    AnalyticsPageViewSchema,
    AnalyticsProductRefSchema,
    AnalyticsPromotionSchema,
} from '../../../models/analytics/event-parts.model.js';
import { ProductSearchIdentifierSchema } from '../../../models/identifiers.model.js';
import { AnalyticsEventMutationBaseSchema } from './base.mutation.js';

export const AnalyticsMutationPageViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    page: AnalyticsPageViewSchema,
});

export const AnalyticsMutationSearchResultsViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    search: ProductSearchIdentifierSchema.meta({ description: 'The search that produced the results.' }),
    products: z.array(AnalyticsProductRefSchema).meta({ description: 'The products shown. An empty list means zero results.' }),
});

export const AnalyticsMutationAutocompleteSuggestionSelectedSchema = AnalyticsEventMutationBaseSchema.extend({
    suggestion: AnalyticsAutocompleteSuggestionSchema,
    position: z.int().min(0),
});

export const AnalyticsMutationCategoryViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    category: AnalyticsCategoryRefSchema,
    products: z.array(AnalyticsProductRefSchema).optional(),
});

export const AnalyticsMutationProductCarouselViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    carousel: AnalyticsCarouselSchema,
    products: z.array(AnalyticsProductRefSchema),
});

export const AnalyticsMutationProductClickedSchema = AnalyticsEventMutationBaseSchema.extend({
    product: AnalyticsProductRefSchema,
});

export const AnalyticsMutationProductViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    product: AnalyticsProductRefSchema,
});

export const AnalyticsMutationPromotionViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    promotion: AnalyticsPromotionSchema,
});

export const AnalyticsMutationPromotionClickedSchema = AnalyticsEventMutationBaseSchema.extend({
    promotion: AnalyticsPromotionSchema,
});

export type AnalyticsMutationPageViewed = InferType<typeof AnalyticsMutationPageViewedSchema>;
export type AnalyticsMutationSearchResultsViewed = InferType<typeof AnalyticsMutationSearchResultsViewedSchema>;
export type AnalyticsMutationAutocompleteSuggestionSelected = InferType<typeof AnalyticsMutationAutocompleteSuggestionSelectedSchema>;
export type AnalyticsMutationCategoryViewed = InferType<typeof AnalyticsMutationCategoryViewedSchema>;
export type AnalyticsMutationProductCarouselViewed = InferType<typeof AnalyticsMutationProductCarouselViewedSchema>;
export type AnalyticsMutationProductClicked = InferType<typeof AnalyticsMutationProductClickedSchema>;
export type AnalyticsMutationProductViewed = InferType<typeof AnalyticsMutationProductViewedSchema>;
export type AnalyticsMutationPromotionViewed = InferType<typeof AnalyticsMutationPromotionViewedSchema>;
export type AnalyticsMutationPromotionClicked = InferType<typeof AnalyticsMutationPromotionClickedSchema>;
