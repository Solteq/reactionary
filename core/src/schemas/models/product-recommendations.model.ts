import z from "zod";
import { ProductIdentifierSchema, ProductRecommendationIdentifierSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";
import { ProductSearchResultItemSchema } from "./product-search.model.js";

export const BaseProductRecommendationSchema = z.looseObject({
    recommendationIdentifier: ProductRecommendationIdentifierSchema.describe('The identifier for the product recommendation, which includes a key and an algorithm and any other vendor specific/instance specific data '),
});

export const ProductRecommendationIdOnlySchema = BaseProductRecommendationSchema.extend({
    recommendationReturnType: z.literal('idOnly').describe('The type of recommendation return'),
    product: ProductIdentifierSchema.describe('The identifier for the recommended product.'),
});
export const ProductRecommendationProductSearchResultItemSchema = BaseProductRecommendationSchema.extend({
    recommendationReturnType: z.literal('productSearchResultItem').describe('The type of recommendation return'),
    product: ProductSearchResultItemSchema.describe('The recommended product, including its identifier, name, slug, and variants. This can be used to display the recommended product directly on the frontend without needing to make an additional request to fetch the product details.'),
});

export const ProductRecommendationSchema = z.discriminatedUnion('recommendationReturnType', [
  ProductRecommendationIdOnlySchema,
  ProductRecommendationProductSearchResultItemSchema
]);

export type ProductRecommendationIdOnly = z.infer<typeof ProductRecommendationIdOnlySchema>;
export type ProductRecommendationSearchItem = z.infer<typeof ProductRecommendationProductSearchResultItemSchema>;
export type ProductRecommendation = z.infer<typeof ProductRecommendationSchema>;
