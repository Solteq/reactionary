import * as z from "zod";
import { ProductIdentifierSchema, ProductRecommendationIdentifierSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";
import { ProductSearchResultItemSchema } from "./product-search.model.js";
import type { InferType } from "../../zod-utils.js";
import { BaseModelSchema } from "./base.model.js";

export const BaseProductRecommendationSchema = BaseModelSchema.extend({
    recommendationIdentifier: ProductRecommendationIdentifierSchema.describe('The identifier for the product recommendation, which includes a key and an algorithm and any other vendor specific/instance specific data '),
});

export const ProductRecommendationIdOnlySchema = BaseProductRecommendationSchema.extend({
    recommendationReturnType: z.literal('idOnly').meta({ description: 'The type of recommendation return' }),
    product: ProductIdentifierSchema.describe('The identifier for the recommended product.'),
});
export const ProductRecommendationProductSearchResultItemSchema = BaseProductRecommendationSchema.extend({
    recommendationReturnType: z.literal('productSearchResultItem').meta({ description: 'The type of recommendation return' }),
    product: ProductSearchResultItemSchema.describe('The recommended product, including its identifier, name, slug, and variants. This can be used to display the recommended product directly on the frontend without needing to make an additional request to fetch the product details.'),
});

export const ProductRecommendationSchema = z.discriminatedUnion('recommendationReturnType', [
  ProductRecommendationIdOnlySchema,
  ProductRecommendationProductSearchResultItemSchema
]);

export type ProductRecommendationIdOnly = InferType<typeof ProductRecommendationIdOnlySchema>;
export type ProductRecommendationSearchItem = InferType<typeof ProductRecommendationProductSearchResultItemSchema>;
export type ProductRecommendation = InferType<typeof ProductRecommendationSchema>;
