import type { Result, ProductReview, ProductRatingSummary, ProductReviewPaginatedResult } from '../schemas/index.js';
import type { ProductReviewsListQuery, ProductReviewsGetRatingSummaryQuery } from '../schemas/queries/product-reviews.query.js';
import type { ProductReviewMutationSubmit } from '../schemas/mutations/product-reviews.mutation.js';
import { BaseProvider } from './base.provider.js';
import { type ProductRatingIdentifier } from '../schemas/models/identifiers.model.js';
/**
 * The product reviews provider is responsible for providing detailed product reviews from customers.
 * Reviews contain ratings along with textual feedback, author information, and verification status.
 * This provider also handles aggregated rating summaries for products.
 */
export abstract class ProductReviewsProvider extends BaseProvider {
  /**
   * Get the rating summary for a product, including average rating and distribution.
   *
   * Usecase: Display rating summary on product detail pages or product listing pages.
   * @param query The product to get ratings for
   */
  public abstract getRatingSummary(
    query: ProductReviewsGetRatingSummaryQuery
  ): Promise<Result<ProductRatingSummary>>;

  /**
   * Get a paginated list of reviews for a product.
   *
   * Usecase: Display customer reviews on product detail pages with filtering and sorting options.
   * @param query The query parameters including product, pagination, sorting, and filtering options
   */
  public abstract findReviews(
    query: ProductReviewsListQuery
  ): Promise<Result<ProductReviewPaginatedResult>>;
  /**
   * Submit a review for a product.
   *
   * Usecase: Allow customers to submit detailed reviews with ratings for products they have purchased.
   * @param mutation The review submission data including rating, title, and content
   */
  public abstract submitReview(
    mutation: ProductReviewMutationSubmit
  ): Promise<Result<ProductReview>>;


  protected createEmptyProductRatingSummary(key: ProductRatingIdentifier): ProductRatingSummary {
    return {
      identifier: key,
      averageRating: 0,
      totalRatings: undefined,
      ratingDistribution: undefined
    } satisfies ProductRatingSummary;
  }


  getResourceName(): string {
    return 'product-reviews';
  }
}
