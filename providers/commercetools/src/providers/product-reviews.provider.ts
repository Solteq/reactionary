import {
  ProductReviewsProvider,
  Reactionary,
  success,
  error,
  ProductReviewSchema,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
} from '@reactionary/core';
import type {
  ProductReview,
  ProductRatingSummary,
  ProductReviewPaginatedResult,
  ProductReviewsListQuery,
  ProductReviewsGetRatingSummaryQuery,
  ProductReviewMutationSubmit,
  Result,
  RequestContext,
  Cache,
  NotFoundError,
  InvalidInputError,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { Review as CTReview } from '@commercetools/platform-sdk';

export class CommercetoolsProductReviewsProvider extends ProductReviewsProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected async getAdminClient() {
    const client = await this.commercetools.getAdminClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
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
    const client = await this.getClient();

    // Get all reviews for the product to calculate summary
    const response = await client
      .productProjections()
      .withKey({ key: query.product.key })
      .get()
      .execute().catch((e) => {
        if (e.statusCode === 404) {
            return null;
        }
        throw e; // Rethrow other errors
      });

    if (response && response.body) {
      const summary: ProductRatingSummary = {
        identifier: {
          product: query.product,
        },
        averageRating: 0,
        totalRatings: 0,
      }

      if (response.body.reviewRatingStatistics) {
        summary.averageRating = response.body.reviewRatingStatistics.averageRating;
        summary.totalRatings = response.body.reviewRatingStatistics.count;
        summary.ratingDistribution = {
          '1': response.body.reviewRatingStatistics.ratingsDistribution['1'] ?? 0,
          '2': response.body.reviewRatingStatistics.ratingsDistribution['2'] ?? 0,
          '3': response.body.reviewRatingStatistics.ratingsDistribution['3'] ?? 0,
          '4': response.body.reviewRatingStatistics.ratingsDistribution['4'] ?? 0,
          '5': response.body.reviewRatingStatistics.ratingsDistribution['5'] ?? 0,
        };
      }
      return success(summary);
    } else {
      return success(this.createEmptyProductRatingSummary({ product: query.product }));
    }
  }

  @Reactionary({
    outputSchema: ProductReviewPaginatedResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 60,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async findReviews(
    query: ProductReviewsListQuery
  ): Promise<Result<ProductReviewPaginatedResult>> {
    const client = await this.getClient();

    const pageNumber = query.paginationOptions?.pageNumber ?? 1;
    const pageSize = query.paginationOptions?.pageSize ?? 20;
    const offset = (pageNumber - 1) * pageSize;


    const product = await client.productProjections().withKey({ key: query.product.key }).get().execute().catch((e) => {
      if (e.statusCode === 404) {
          return null;
      }
      throw e; // Rethrow other errors
    });

    if (!product || !product.body) {
      return success({
        items: [],
        totalCount: 0,
        pageSize,
        pageNumber,
        totalPages: 0,
      })
    }

    // Build where clause
    const whereClause = `target(typeId="product" and id="${product.body.id}")`;
    /*
    if (query.filterByRating) {
      const minRating = query.filterByRating - 0.5;
      const maxRating = query.filterByRating + 0.5;
      whereClause += ` and rating >= ${minRating} and rating < ${maxRating}`;
    }

    // Build sort clause
    let sort: string[] = [];
    switch (query.sortBy) {
      case 'recent':
        sort = ['createdAt desc'];
        break;
      case 'rating-high':
        sort = ['rating desc', 'createdAt desc'];
        break;
      case 'rating-low':
        sort = ['rating asc', 'createdAt desc'];
        break;
      default:
        sort = ['createdAt desc'];
    }*/

    const sort = ['createdAt desc'];

    const response = await client
      .reviews()
      .get({
        queryArgs: {
          where: whereClause,
          limit: pageSize,
          offset,
          sort,
        },
      })
      .execute();

    const reviews = response.body.results.map((review) =>
      this.parseSingle(review, query.product.key)
    );
    const returnedResult: ProductReviewPaginatedResult = {
      items: reviews,
      totalCount: response.body.total || reviews.length,
      pageSize,
      pageNumber,
      totalPages: Math.ceil((response.body.total || reviews.length) / Math.max(pageSize, 1)),
    };

    return success(returnedResult);
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


    if (!(this.context.session.identityContext.identity.type === 'Registered')) {
      return error<InvalidInputError>({ type: 'InvalidInput', error: 'Only registered users can submit reviews.' });
    }

    const client = await this.getAdminClient();

    const response = await client
      .reviews()
      .post({
        body: {
          authorName: mutation.authorName,
          title: mutation.title,
          text: mutation.content,
          rating: mutation.rating,
          customer: {
            typeId: 'customer',
            id: this.context.session.identityContext.identity.id.userId,
          },
          target: {
            typeId: 'product',
            id: mutation.product.key,
          },
          locale: this.context.languageContext.locale,
        },
      })
      .execute();

    const review = this.parseSingle(response.body, mutation.product.key);

    return success(review);
  }

  protected parseSingle(review: CTReview, productKey: string): ProductReview {
    return {
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
      verified: !!review.customer, // Verified if linked to a customer
    } satisfies ProductReview;
  }
}
