import * as z from "zod";
import type { InferType } from "../../zod-utils.js";
import { CategoryIdentifierSchema, ProductIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";

export const ProductRecommendationBaseQuerySchema = BaseQuerySchema.extend({
  numberOfRecommendations: z.number().min(1).max(12).meta({ description: 'The number of recommendations requested. The provider may return fewer than this number, but should not return more.' }),
  labels: z.array(z.string()).optional().meta({ description: 'The customer segments, quirks, chirps or other labels to which the recommendations can optimize themselves to be relevant. This can be used by the provider to personalize the recommendations based on the preferences and behaviors of users in these segments.' }),
});

export const ProductRecommendationsByCollectionQuerySchema = ProductRecommendationBaseQuerySchema.extend({
  collectionName: z.string().meta({ description: 'The name of the collection for which to get product recommendations. This is to access either manually curated lists, or interface marketing rules engines that define zones by name' }),
  sourceProduct: z.array(ProductIdentifierSchema).optional().meta({ description: 'The products on screen or in the context you are asking for the recommendations. Could be all the variants from the current cart (resolved into their products), or just the variant of the PDP, or the 4 first products of a category.' }),
  sourceCategory: CategoryIdentifierSchema.optional().describe('The category identifier to use as a seed for the recommendations. The provider should return recommendations that are relevant to this category, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences. This is optional, as the collection may already be curated to be relevant to a specific product or category, but it can be used by the provider to further personalize the recommendations based on the preferences and behaviors of users who have interacted with this category.'),
});

export const ProductRecommendationProductBasedBaseQuerySchema = ProductRecommendationBaseQuerySchema.extend({
  sourceProduct: ProductIdentifierSchema.describe('The product identifiers for which to get recommendations. The provider should return recommendations that are relevant to these products, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences.'),
});

export const ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuerySchema = ProductRecommendationProductBasedBaseQuerySchema.extend({
  algorithm: z.literal('frequentlyBoughtTogether').meta({ description: 'The provider should return recommendations based on products that are frequently bought together with the source products. The provider should leverage the Request Context to personalize the recommendations as much as possible, taking into account factors such as the user\'s browsing history, purchase history, and demographic information.' }),
});

export const ProductRecommendationAlgorithmSimilarProductsQuerySchema = ProductRecommendationProductBasedBaseQuerySchema.extend({
  algorithm: z.literal('similar').meta({ description: 'The provider should return recommendations based on products that are similar to the source products either visually or data wise' }),
});

export const ProductRecommendationAlgorithmRelatedProductsQuerySchema = ProductRecommendationProductBasedBaseQuerySchema.extend({
  algorithm: z.literal('related').meta({ description: 'The provider should return recommendations based on products that are related to the source products. ' }),
});

export const ProductRecommendationAlgorithmTrendingInCategoryQuerySchema = ProductRecommendationBaseQuerySchema.extend({
  algorithm: z.literal('trendingInCategory').meta({ description: 'The provider should return recommendations based on products that are trending in the specified category. The provider should leverage the Request Context to personalize the recommendations as much as possible, taking into account factors such as the user\'s browsing history, purchase history, and demographic information.' }),
  sourceCategory: CategoryIdentifierSchema.describe('The category identifier for which to get trending product recommendations. The provider should return recommendations that are relevant to this category, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences.'),
});


// unsure if we need both Popular and TopPicks, as they are quite similar. Maybe we can merge them into one algorithm with a parameter to specify the type of popularity? For now, I'll keep them separate for clarity.
export const ProductRecommendationAlgorithmPopuplarProductsQuerySchema = ProductRecommendationBaseQuerySchema.extend({
  algorithm: z.literal('popular').meta({ description: 'The provider should return recommendations based on products that are popular among users. The provider should leverage the Request Context to personalize the recommendations as much as possible, taking into account factors such as the user\'s browsing history, purchase history, and demographic information.' }),
});

export const ProductRecommendationAlgorithmTopPicksProductsQuerySchema = ProductRecommendationBaseQuerySchema.extend({
  algorithm: z.literal('topPicks').meta({ description: 'The provider should return recommendations based on products that are top picks among users. The provider should leverage the Request Context to personalize the recommendations as much as possible, taking into account factors such as the user\'s browsing history, purchase history, and demographic information.' }) ,
});

export const ProductRecommendationAlgorithmAlsoViewedProductsQuerySchema = ProductRecommendationProductBasedBaseQuerySchema.extend({
  algorithm: z.literal('alsoViewed').meta({ description: 'The provider should return recommendations based on products that are also viewed by users. The provider should leverage the Request Context to personalize the recommendations as much as possible, taking into account factors such as the user\'s browsing history, purchase history, and demographic information.' }) ,
});



export const ProductRecommendationsQuerySchema = z.discriminatedUnion('algorithm', [
  ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuerySchema,
  ProductRecommendationAlgorithmTrendingInCategoryQuerySchema,
  ProductRecommendationAlgorithmSimilarProductsQuerySchema,
  ProductRecommendationAlgorithmRelatedProductsQuerySchema,
  ProductRecommendationAlgorithmPopuplarProductsQuerySchema,
  ProductRecommendationAlgorithmTopPicksProductsQuerySchema,
  ProductRecommendationAlgorithmAlsoViewedProductsQuerySchema
]);

export type ProductRecommendationsQuery = InferType<typeof ProductRecommendationsQuerySchema>;
export type ProductRecommendationsByCollectionQuery = InferType<typeof ProductRecommendationsByCollectionQuerySchema>;
export type ProductRecommendationAlgorithmTopPicksProductsQuery = InferType<typeof ProductRecommendationAlgorithmTopPicksProductsQuerySchema>;
export type ProductRecommendationAlgorithmPopuplarProductsQuery = InferType<typeof ProductRecommendationAlgorithmPopuplarProductsQuerySchema>;
export type ProductRecommendationAlgorithmTrendingInCategoryQuery = InferType<typeof ProductRecommendationAlgorithmTrendingInCategoryQuerySchema>;
export type ProductRecommendationAlgorithmRelatedProductsQuery = InferType<typeof ProductRecommendationAlgorithmRelatedProductsQuerySchema>;
export type ProductRecommendationAlgorithmSimilarProductsQuery= InferType<typeof ProductRecommendationAlgorithmSimilarProductsQuerySchema>;
export type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery = InferType<typeof ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuerySchema>;
export type ProductRecommendationAlgorithmAlsoViewedProductsQuery = InferType<typeof ProductRecommendationAlgorithmAlsoViewedProductsQuerySchema>;
