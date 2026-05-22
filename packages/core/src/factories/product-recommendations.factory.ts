import type * as z from 'zod';
import type { ProductRecommendationSchema } from '../schemas/models/product-recommendations.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductRecommendationSchema = z.ZodType<
  z.output<typeof ProductRecommendationSchema>
>;

export interface ProductRecommendationsFactory<
  TProductRecommendationSchema extends
    AnyProductRecommendationSchema = AnyProductRecommendationSchema,
> {
  productRecommendationSchema: TProductRecommendationSchema;
  parseRecommendation(
    context: RequestContext,
    data: unknown,
  ): z.output<TProductRecommendationSchema>;
}

export type ProductRecommendationsFactoryOutput<
  TFactory extends ProductRecommendationsFactory,
> = ReturnType<TFactory['parseRecommendation']>;

export type ProductRecommendationsFactoryWithOutput<
  TFactory extends ProductRecommendationsFactory,
> = Omit<TFactory, 'parseRecommendation'> & {
  parseRecommendation(
    context: RequestContext,
    data: unknown,
  ): ProductRecommendationsFactoryOutput<TFactory>;
};
