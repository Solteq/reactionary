import type {
  AnyProductRatingSummarySchema,
  AnyProductReviewPaginatedSchema,
  AnyProductReviewSchema,
  ProductIdentifier,
  ProductRatingSummary,
  ProductRatingSummarySchema,
  ProductReview,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  ProductReviewsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoProductReview } from '../../schema/magento.types.js';
import {
  buildProductReviewKey,
  ratingPercentToStars,
  toIsoTimestamp,
} from '../../utils/magento-review.js';

export interface MagentoProductRatingSummaryFactoryInput {
  product: ProductIdentifier;
  /** Magento's `rating_summary`, a percentage (0-100). */
  ratingSummary: number | null | undefined;
  /** Magento's `review_count`. */
  reviewCount: number | null | undefined;
}

export interface MagentoProductReviewFactoryInput {
  product: ProductIdentifier;
  sku: string;
  review: MagentoProductReview;
}

export interface MagentoProductReviewPaginatedFactoryInput {
  product: ProductIdentifier;
  sku: string;
  reviews: MagentoProductReview[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
}

export class MagentoProductReviewsFactory<
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

  /**
   * Magento's GraphQL schema offers no per-star breakdown, so the distribution
   * is left undefined rather than reconstructed from the current page.
   */
  public parseRatingSummary(
    _context: RequestContext,
    data: MagentoProductRatingSummaryFactoryInput,
  ): z.output<TRatingSummarySchema> {
    return this.ratingSummarySchema.parse({
      identifier: {
        product: data.product,
      },
      averageRating: ratingPercentToStars(data.ratingSummary),
      totalRatings: data.reviewCount ?? undefined,
      ratingDistribution: undefined,
    } satisfies ProductRatingSummary);
  }

  /**
   * Magento does not expose whether a review came from a confirmed purchase, so
   * `verified` is always false.
   */
  public parseReview(
    _context: RequestContext,
    data: MagentoProductReviewFactoryInput,
  ): z.output<TReviewSchema> {
    return this.reviewSchema.parse({
      identifier: {
        key: buildProductReviewKey(data.sku, data.review),
      },
      product: data.product,
      authorName: data.review.nickname || 'Anonymous',
      rating: ratingPercentToStars(data.review.average_rating),
      title: data.review.summary ?? '',
      content: data.review.text ?? '',
      createdAt: toIsoTimestamp(data.review.created_at),
      verified: false,
    } satisfies ProductReview);
  }

  public parseReviewPaginatedResult(
    context: RequestContext,
    data: MagentoProductReviewPaginatedFactoryInput,
  ): z.output<TReviewPaginatedSchema> {
    return this.reviewPaginatedSchema.parse({
      items: data.reviews.map((review) =>
        this.parseReview(context, {
          product: data.product,
          sku: data.sku,
          review,
        }),
      ),
      totalCount: data.totalCount,
      pageSize: data.pageSize,
      pageNumber: data.pageNumber,
      totalPages: Math.ceil(data.totalCount / Math.max(data.pageSize, 1)),
    });
  }
}
