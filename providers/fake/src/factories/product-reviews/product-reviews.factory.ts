import type {
  AnyProductRatingSummarySchema,
  AnyProductReviewPaginatedSchema,
  AnyProductReviewSchema,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  ProductReviewsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeProductReviewsFactory<
  TRatingSummarySchema extends AnyProductRatingSummarySchema = typeof ProductRatingSummarySchema,
  TReviewSchema extends AnyProductReviewSchema = typeof ProductReviewSchema,
  TReviewPaginatedSchema extends AnyProductReviewPaginatedSchema = typeof ProductReviewPaginatedResultSchema,
> implements ProductReviewsFactory<TRatingSummarySchema, TReviewSchema, TReviewPaginatedSchema>
{
  public readonly ratingSummarySchema: TRatingSummarySchema;
  public readonly reviewSchema: TReviewSchema;
  public readonly reviewPaginatedSchema: TReviewPaginatedSchema;

  constructor(
    ratingSummarySchema: TRatingSummarySchema,
    reviewSchema: TReviewSchema,
    reviewPaginatedSchema: TReviewPaginatedSchema,
  ) {
    this.ratingSummarySchema = ratingSummarySchema;
    this.reviewSchema = reviewSchema;
    this.reviewPaginatedSchema = reviewPaginatedSchema;
  }

  public parseRatingSummary(
    _context: RequestContext,
    data: unknown,
  ): z.output<TRatingSummarySchema> {
    return this.ratingSummarySchema.parse(data);
  }

  public parseReview(
    _context: RequestContext,
    data: unknown,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse(data);
  }

  public parseReviewPaginatedResult(
    _context: RequestContext,
    data: unknown,
  ): z.output<TReviewPaginatedSchema> {
    return this.reviewPaginatedSchema.parse(data);
  }
}
