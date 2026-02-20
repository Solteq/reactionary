import {
  ProductReviewsProvider,
  Reactionary,
  success,
  error,
  ProductReviewSchema,
  ProductRatingSummarySchema,
} from '@reactionary/core';
import type {
  ProductReview,
  ProductRatingSummary,
  ProductReviewsListQuery,
  ProductReviewsGetRatingSummaryQuery,
  ProductReviewMutationSubmit,
  Result,
  RequestContext,
  Cache,
  NotFoundError,
  InvalidInputError,
} from '@reactionary/core';
import type { LipscoreConfiguration } from '../schema/configuration.schema.js';


interface LipscoreReview {
    id: number,
    title: string;
    text: string;
    rating: string;
    created_at: string;
    review_reply: {
      text: string;
      created_at: string;
    },
    user: {
      id: string;
      name: string;
    };
}

interface LipscoreReviewResultItem {
  rating: number;
  review_count: number;
  reviews: LipscoreReview[];
}

interface LipscoreRatingStats {
  rating: number;
  review_count: number;
}

export class LipscoreProductReviewsProvider extends ProductReviewsProvider {
  protected config: LipscoreConfiguration;

  constructor(
    config: LipscoreConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);
    this.config = config;
  }

  protected async fetchFromLipscore<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers = {
      'X-Authorization': this.config.apiSecretKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Lipscore API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }



  @Reactionary({
    outputSchema: ProductRatingSummarySchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async getRatingSummary(
    query: ProductReviewsGetRatingSummaryQuery
  ): Promise<Result<ProductRatingSummary>> {
    const qs = new URLSearchParams({
      internal_id: query.product.key,
      fields: 'rating,review_count',
      api_key: this.config.apiKey,
    });

    const stats = await this.fetchFromLipscore<LipscoreRatingStats[]>(
      `products?${qs.toString()}`
    );

    if (stats.length === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: query.product.key,
      });
    }

    const ratingAvg = stats[0];


    const summary: ProductRatingSummary = {
      identifier: {
        product: query.product,
      },
      averageRating: ratingAvg.rating,
      totalRatings: ratingAvg.review_count
    };

    return success(summary);
  }

  @Reactionary({
    outputSchema: ProductReviewSchema.array(),
    cache: true,
    cacheTimeToLiveInSeconds: 60,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async listReviews(
    query: ProductReviewsListQuery
  ): Promise<Result<ProductReview[]>> {
    const pageNumber = query.paginationOptions?.pageNumber ?? 1;
    const pageSize = query.paginationOptions?.pageSize ?? 20;

    // Build query parameters
    const params = new URLSearchParams({
      internal_id: query.product.key,
      fields: 'rating,votes,review_count,reviews',
      api_key: this.config.apiKey,
    });

    try {
      const response = await this.fetchFromLipscore<LipscoreReviewResultItem[]>(
        `/products?${params.toString()}`
      );


      if (response && response.length === 0) {
        return error<NotFoundError>({ type: 'NotFound', identifier: query.product });
      }

      const review = response[0].reviews.map((review) => this.parseReview(review, query.product.key));

      return success(review);
    } catch (err) {
      return success([]);
    }
  }

  @Reactionary({
    outputSchema: ProductReviewSchema,
    cache: false,
    cacheTimeToLiveInSeconds: 0,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async submitReview(
    mutation: ProductReviewMutationSubmit
  ): Promise<Result<ProductReview>> {
    return error<InvalidInputError>({ type: 'InvalidInput', error: 'Submitting reviews is not supported by the Lipscore provider' });
  }

  protected parseReview(review: LipscoreReview, productKey: string): ProductReview {
    return {
      identifier: {
        key: review.id + '',
      },
      product: {
        key: productKey,
      },
      authorName: review.user.name,
      authorId: review.user.id,
      rating: Number(review.rating),
      title: review.title,
      content: review.text,
      createdAt: review.created_at,
      verified: true,
      updatedAt: review.created_at,
      reply: review.review_reply ? review.review_reply.text : undefined,
      repliedAt: review.review_reply ? review.review_reply.created_at : undefined,
    };
  }
}
