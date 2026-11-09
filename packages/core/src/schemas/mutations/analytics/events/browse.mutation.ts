import * as z from 'zod';
import type { InferType } from '../../../../zod-utils.js';
import {
    AnalyticsAutocompleteSuggestionSchema,
    AnalyticsCarouselSchema,
    AnalyticsCategoryRefSchema,
    AnalyticsContentSchema,
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

export const AnalyticsMutationContentViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    content: AnalyticsContentSchema,
    concepts: z.array(z.string().max(128)).max(50).meta({ description: 'The ids of the taxonomy concepts the content is tagged with, e.g. "features/cordless". The caller supplies them, because the CMS is not a capability: pass the direct tags of the content, not their ancestors, most important first. At most 50, each at most 128 characters. An empty list is allowed.' }),
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
export type AnalyticsMutationContentViewed = InferType<typeof AnalyticsMutationContentViewedSchema>;
export type AnalyticsMutationPromotionViewed = InferType<typeof AnalyticsMutationPromotionViewedSchema>;
export type AnalyticsMutationPromotionClicked = InferType<typeof AnalyticsMutationPromotionClickedSchema>;
