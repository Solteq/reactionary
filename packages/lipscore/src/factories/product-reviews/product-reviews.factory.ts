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
  LipscoreReview,
  LipscoreProductsResponse,
} from '../../schema/lipscore.schema.js';

export interface LipscoreReviewsPage {
  response: LipscoreProductsResponse;
  productKey: string;
  pageSize: number;
  pageNumber: number;
}

export class LipscoreProductReviewsFactory<
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
    data: LipscoreProductsResponse,
  ): z.output<TRatingSummarySchema> {
    const product = data[0];
    const reviews = product?.reviews ?? [];

    if (reviews.length === 0) {
      return this.ratingSummarySchema.parse({
        identifier: { product: { key: String(product?.internal_id ?? '') } },
        averageRating: 0,
        totalRatings: undefined,
        ratingDistribution: undefined,
      });
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Math.round((sum / total) * 100) / 100;

    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const review of reviews) {
      const key = String(Math.min(5, Math.max(1, Math.round(review.rating))));
      distribution[key] = (distribution[key] ?? 0) + 1;
    }

    return this.ratingSummarySchema.parse({
      identifier: { product: { key: String(product?.internal_id ?? '') } },
      averageRating,
      totalRatings: total,
      ratingDistribution: distribution,
    });
  }

  parseReview(
    _context: RequestContext,
    data: LipscoreReview,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse({
      identifier: { key: String(data.id) },
      product: { key: String(data.id) },
      authorName: data.displayed_name ?? data.user?.name ?? 'Anonymous',
      authorId: data.user?.id != null ? String(data.user.id) : undefined,
      rating: data.rating,
      title: '',
      content: data.text ?? data.translated_text ?? '',
      reply:
        typeof data.review_reply === 'string' ? data.review_reply : undefined,
      repliedAt: undefined,
      createdAt: data.created_at,
      updatedAt: undefined,
      verified: data.testimonial ?? false,
    });
  }

  parseReviewPaginatedResult(
    context: RequestContext,
    data: LipscoreReviewsPage,
  ): z.output<TReviewPaginatedSchema> {
    const product = data.response[0];
    const allReviews = product?.reviews ?? [];
    const totalCount = allReviews.length;

    const pageSize = data.pageSize > 0 ? data.pageSize : 10;
    const pageNumber = data.pageNumber > 0 ? data.pageNumber : 1;
    const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;

    const offset = (pageNumber - 1) * pageSize;
    const pageReviews = allReviews.slice(offset, offset + pageSize);

    const items = pageReviews.map((r) => {
      const parsed = this.parseReview(context, r);
      return { ...parsed, product: { key: data.productKey } };
    });

    return this.reviewPaginatedSchema.parse({
      items,
      totalCount,
      pageSize,
      pageNumber,
      totalPages,
    });
  }
}
