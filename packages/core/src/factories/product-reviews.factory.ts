import type * as z from 'zod';
import type {
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
} from '../schemas/models/product-reviews.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductRatingSummarySchema = z.ZodType<
  z.output<typeof ProductRatingSummarySchema>
>;
export type AnyProductReviewSchema = z.ZodType<z.output<typeof ProductReviewSchema>>;
export type AnyProductReviewPaginatedSchema = z.ZodType<
  z.output<typeof ProductReviewPaginatedResultSchema>
>;

export interface ProductReviewsFactory<
  TRatingSummarySchema extends AnyProductRatingSummarySchema = AnyProductRatingSummarySchema,
  TReviewSchema extends AnyProductReviewSchema = AnyProductReviewSchema,
  TReviewPaginatedSchema extends AnyProductReviewPaginatedSchema = AnyProductReviewPaginatedSchema,
> {
  ratingSummarySchema: TRatingSummarySchema;
  reviewSchema: TReviewSchema;
  reviewPaginatedSchema: TReviewPaginatedSchema;
  parseRatingSummary(
    context: RequestContext,
    data: unknown,
  ): z.output<TRatingSummarySchema>;
  parseReview(context: RequestContext, data: unknown): z.output<TReviewSchema>;
  parseReviewPaginatedResult(
    context: RequestContext,
    data: unknown,
  ): z.output<TReviewPaginatedSchema>;
}

export type ProductReviewsFactoryRatingOutput<TFactory extends ProductReviewsFactory> =
  ReturnType<TFactory['parseRatingSummary']>;
export type ProductReviewsFactoryReviewOutput<TFactory extends ProductReviewsFactory> =
  ReturnType<TFactory['parseReview']>;
export type ProductReviewsFactoryReviewPaginatedOutput<
  TFactory extends ProductReviewsFactory,
> = ReturnType<TFactory['parseReviewPaginatedResult']>;

export type ProductReviewsFactoryWithOutput<TFactory extends ProductReviewsFactory> =
  Omit<TFactory, 'parseRatingSummary' | 'parseReview' | 'parseReviewPaginatedResult'> & {
    parseRatingSummary(
      context: RequestContext,
      data: unknown,
    ): ProductReviewsFactoryRatingOutput<TFactory>;
    parseReview(
      context: RequestContext,
      data: unknown,
    ): ProductReviewsFactoryReviewOutput<TFactory>;
    parseReviewPaginatedResult(
      context: RequestContext,
      data: unknown,
    ): ProductReviewsFactoryReviewPaginatedOutput<TFactory>;
  };
