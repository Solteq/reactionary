import type * as z from 'zod';
import type {
  AnyProductRatingSummarySchema,
  AnyProductReviewPaginatedSchema,
  AnyProductReviewSchema,
  ProductReviewsFactory,
  RequestContext,
  ProductRatingSummarySchema,
  ProductReviewSchema,
  ProductReviewPaginatedResultSchema,
} from '@reactionary/core';
import type {
  BvReview,
  BvReviewsResponse,
  BvStatisticsResponse,
} from '../../schema/bazaarvoice.schema.js';

export class BazaarvoiceProductReviewsFactory<
  TRatingSummarySchema extends
    AnyProductRatingSummarySchema = typeof ProductRatingSummarySchema,
  TReviewSchema extends AnyProductReviewSchema = typeof ProductReviewSchema,
  TReviewPaginatedSchema extends
    AnyProductReviewPaginatedSchema = typeof ProductReviewPaginatedResultSchema,
> implements
    ProductReviewsFactory<
      TRatingSummarySchema,
      TReviewSchema,
      TReviewPaginatedSchema
    >
{
  constructor(
    public readonly ratingSummarySchema: TRatingSummarySchema,
    public readonly reviewSchema: TReviewSchema,
    public readonly reviewPaginatedSchema: TReviewPaginatedSchema,
  ) {}

  parseRatingSummary(
    _context: RequestContext,
    data: BvStatisticsResponse,
  ): z.output<TRatingSummarySchema> {
    const result = data.Results[0];
    const stats = result?.ProductStatistics?.ReviewStatistics;

    if (!result || !stats) {
      return this.ratingSummarySchema.parse({
        identifier: { product: { key: '' } },
        averageRating: 0,
        totalRatings: undefined,
        ratingDistribution: undefined,
      });
    }

    const distribution = stats.RatingDistribution
      ? Object.fromEntries(
          stats.RatingDistribution.map((entry) => [
            String(entry.RatingValue),
            entry.Count,
          ]),
        )
      : undefined;

    return this.ratingSummarySchema.parse({
      identifier: { product: { key: result.ProductStatistics.ProductId } },
      averageRating: stats.AverageOverallRating,
      totalRatings: stats.TotalReviewCount,
      ratingDistribution: distribution,
    });
  }

  parseReview(
    _context: RequestContext,
    data: BvReview,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse({
      identifier: { key: data.Id },
      product: { key: data.ProductId ?? '' },
      authorName: data.UserNickname ?? 'Anonymous',
      authorId: data.AuthorId,
      rating: data.Rating,
      title: data.Title ?? '',
      content: data.ReviewText ?? '',
      reply: undefined,
      repliedAt: undefined,
      createdAt: data.SubmissionTime,
      updatedAt: data.LastModificationTime,
      verified: data.IsVerifiedPurchaser ?? false,
    });
  }

  parseReviewPaginatedResult(
    context: RequestContext,
    data: BvReviewsResponse,
  ): z.output<TReviewPaginatedSchema> {
    const totalResults = data.TotalResults ?? data.Results.length;
    const limit = data.Limit ?? data.Results.length;
    const offset = data.Offset ?? 0;

    const pageSize = limit > 0 ? limit : 10;
    const pageNumber = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1;
    const totalPages = pageSize > 0 ? Math.ceil(totalResults / pageSize) : 1;

    return this.reviewPaginatedSchema.parse({
      items: data.Results.map((review) => this.parseReview(context, review)),
      totalCount: totalResults,
      pageSize,
      pageNumber,
      totalPages,
    });
  }
}
