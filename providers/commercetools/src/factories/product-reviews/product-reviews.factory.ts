import type { Review as CTReview } from '@commercetools/platform-sdk';
import {
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  type AnyProductRatingSummarySchema,
  type AnyProductReviewPaginatedSchema,
  type AnyProductReviewSchema,
  type ProductRatingSummary,
  type ProductReview,
  type ProductReviewPaginatedResult,
  type ProductReviewsFactory,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsProductReviewsFactory<
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
    data: ProductRatingSummary,
  ): z.output<TRatingSummarySchema> {
    return this.ratingSummarySchema.parse(data);
  }

  public parseReview(
    _context: RequestContext,
    data: ProductReview,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse(data);
  }

  public parseReviewPaginatedResult(
    _context: RequestContext,
    data: ProductReviewPaginatedResult,
  ): z.output<TReviewPaginatedSchema> {
    return this.reviewPaginatedSchema.parse(data);
  }

  public parseReviewFromCommercetools(
    _context: RequestContext,
    review: CTReview,
    productKey: string,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse({
      identifier: {
        key: review.key || '',
      },
      product: {
        key: productKey,
      },
      authorName: review.authorName ?? 'Anonymous',
      authorId: review.customer?.id,
      rating: review.rating ?? 0,
      title: review.title ?? '',
      content: review.text ?? '',
      createdAt: review.createdAt,
      updatedAt: review.lastModifiedAt,
      verified: !!review.customer,
    } satisfies ProductReview);
  }
}
