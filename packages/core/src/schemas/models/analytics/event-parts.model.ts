import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import { CategorySchema } from '../category.model.js';
import {
    CategoryIdentifierSchema,
    ProductIdentifierSchema,
    ProductRecommendationIdentifierSchema,
    StoreIdentifierSchema,
} from '../identifiers.model.js';
import { ProductSchema } from '../product.model.js';
import { StoreSchema } from '../store.model.js';

export const PageTypeSchema = z.enum(['home', 'category', 'search', 'pdp', 'cart', 'checkout', 'content', 'account', 'other']).meta({ description: 'The kind of page that was viewed.' });

export const AnalyticsPageViewSchema = z.looseObject({
    type: PageTypeSchema,
    url: z.string().optional(),
    title: z.string().optional(),
});

export const AnalyticsPromotionSchema = z.looseObject({
    id: z.string().meta({ description: 'The promotion id.' }),
    name: z.string(),
    slot: z.string().meta({ description: 'The placement of the promotion, e.g. "hero".' }),
    creative: z.string().optional().meta({ description: 'The creative shown, if the storefront distinguishes creatives.' }),
});

export const AnalyticsCarouselSchema = z.looseObject({
    recommendationId: ProductRecommendationIdentifierSchema.optional().meta({ description: 'The recommendation the carousel was built from, if any.' }),
    carouselName: z.string().meta({ description: 'Storefront name of the carousel.' }),
});

/**
 * A piece of content that is not a commerce entity, e.g. a CMS article or landing page.
 */
export const AnalyticsContentSchema = z.looseObject({
    key: z.string().meta({ description: 'The id of the content in the CMS, e.g. the article id.' }),
    type: z.string().optional().meta({ description: 'The kind of content, e.g. "article" or "landing-page".' }),
});

export const AnalyticsAutocompleteSuggestionSchema = z.discriminatedUnion('type', [
    z.looseObject({ type: z.literal('term'), term: z.string() }),
    z.looseObject({ type: z.literal('product'), product: ProductIdentifierSchema }),
]);

/**
 * A model or just its identifier. Events accept either; providers look up what they need.
 * Identifier first: model defaults can throw on input that lacks required keys instead of failing the union branch.
 */
export const AnalyticsProductRefSchema = z.union([ProductIdentifierSchema, ProductSchema]);
export const AnalyticsCategoryRefSchema = z.union([CategoryIdentifierSchema, CategorySchema]);
export const AnalyticsStoreRefSchema = z.union([StoreIdentifierSchema, StoreSchema]);

export const AnalyticsCouponRejectionReasonSchema = z.string().meta({ description: 'Why the coupon was rejected, as reported by the backend or storefront.' });
export const AnalyticsChannelSchema = z.string().meta({ description: 'A channel, e.g. "email" for newsletters or "facebook" for sharing.' });

export type PageType = InferType<typeof PageTypeSchema>;
export type AnalyticsPageView = InferType<typeof AnalyticsPageViewSchema>;
export type AnalyticsPromotion = InferType<typeof AnalyticsPromotionSchema>;
export type AnalyticsContent = InferType<typeof AnalyticsContentSchema>;
export type AnalyticsCarousel = InferType<typeof AnalyticsCarouselSchema>;
export type AnalyticsAutocompleteSuggestion = InferType<typeof AnalyticsAutocompleteSuggestionSchema>;
export type AnalyticsProductRef = InferType<typeof AnalyticsProductRefSchema>;
export type AnalyticsCategoryRef = InferType<typeof AnalyticsCategoryRefSchema>;
export type AnalyticsStoreRef = InferType<typeof AnalyticsStoreRefSchema>;
