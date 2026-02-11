import z from "zod";
import { ProductIdentifierSchema, ProductRecommendationIdentifierSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";

export const ProductRecommendationSchema = z.looseObject({
    recommendationIdentifier: ProductRecommendationIdentifierSchema.describe('The identifier for the product recommendation, which includes a key and an algorithm and any other vendor specific/instance specific data '),
    product: ProductIdentifierSchema.describe('The identifier for the recommended product.'),
});


export type ProductRecommendation = z.infer<typeof ProductRecommendationSchema>;
