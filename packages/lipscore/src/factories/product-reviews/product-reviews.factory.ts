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
import type { LipscoreReview } from '../../schema/lipscore.schema.js';

export interface LipscoreRatingSummaryData {
  productKey: string;
  votes: number | null;
  rating: string | null;
}

export interface LipscoreReviewsPage {
  reviews: LipscoreReview[];
  productKey: string;
  pageSize: number;
  pageNumber: number;
  totalReviewCount?: number;
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
    data: LipscoreRatingSummaryData,
  ): z.output<TRatingSummarySchema> {
    const votes = data.votes ?? 0;
    const averageRating =
      votes > 0 && data.rating
        ? Math.round(parseFloat(data.rating) * 100) / 100
        : 0;

    return this.ratingSummarySchema.parse({
      identifier: { product: { key: data.productKey } },
      averageRating,
      totalRatings: votes > 0 ? votes : undefined,
      ratingDistribution: undefined,
    });
  }

  parseReview(
    _context: RequestContext,
    data: LipscoreReview,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse({
      identifier: { key: String(data.id) },
      product: { key: data.product?.internal_id ?? String(data.id) },
      authorName:
        data.displayed_name ??
        data.user?.short_name ??
        data.user?.name ??
        'Anonymous',
      authorId: data.user?.id != null ? String(data.user.id) : undefined,
      rating: data.rating,
      title: '',
      content: data.text ?? data.translated_text ?? '',
      reply: data.review_reply != null ? (data.review_reply.text ?? undefined) : undefined,
      repliedAt:
        data.review_reply != null ? (data.review_reply.created_at ?? undefined) : undefined,
      createdAt: data.created_at,
      updatedAt: undefined,
      verified: false,
    });
  }

  parseReviewPaginatedResult(
    context: RequestContext,
    data: LipscoreReviewsPage,
  ): z.output<TReviewPaginatedSchema> {
    const pageSize = data.pageSize > 0 ? data.pageSize : 10;
    const pageNumber = data.pageNumber > 0 ? data.pageNumber : 1;

    // Use API-provided review_count when available for accurate pagination.
    // Fall back to deriving from page data when not available.
    const totalCount =
      data.totalReviewCount !== undefined
        ? data.totalReviewCount
        : data.reviews.length < pageSize
          ? (pageNumber - 1) * pageSize + data.reviews.length
          : pageNumber * pageSize + 1;

    const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;

    const items = data.reviews.map((r) => {
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
