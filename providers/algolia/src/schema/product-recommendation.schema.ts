import { ProductRecommendationIdentifierSchema } from "@reactionary/core";
import { z } from "zod";

export const AlgoliaProductSearchIdentifierSchema = ProductRecommendationIdentifierSchema.extend({
    abTestID: z.number().optional(),
    abTestVariantID: z.number().optional()
});

export type AlgoliaProductRecommendationIdentifier = z.infer<typeof AlgoliaProductSearchIdentifierSchema>;
