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
  ProductIdentifier,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import { calcSeed } from '../utilities/seed.js';

export class FakeProductReviewsProvider extends ProductReviewsProvider {
  protected config: FakeConfiguration;
  private faker: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);
    this.config = config;
    this.faker = new Faker({ locale: [en] });
  }

  protected createReviewsForProduct(productIdentifier: ProductIdentifier): ProductReview[] {
    const seed = calcSeed(productIdentifier.key);
    this.faker.seed(seed); // Seed faker with product key for consistent results

    const hasAnyReviews = this.faker.datatype.boolean({ probability: 0.5 }); // 50% chance that the product has reviews
    if (!hasAnyReviews) {
      return [];
    }

    if (productIdentifier.key === 'unknown-product-id') {
      return [];
    }

    const reviews: ProductReview[] = [];
    const totalReviews = this.faker.number.int({ min: 1, max: 20 });

    for (let i = 0; i < totalReviews; i++) {
      const hasReply = this.faker.datatype.boolean({ probability: 0.3 }); // 30% chance that the review has a reply

      const review = {
        identifier: {
          key: `fake-review-${productIdentifier.key}-${i}`,
        },
        product: productIdentifier,
        authorName: this.faker.person.fullName(),
        authorId: this.faker.string.uuid(),
        rating: this.faker.number.int({ min: 1, max: 5 }),
        title: this.faker.lorem.sentence(),
        content: this.faker.lorem.paragraphs({ min: 1, max: 5 }),
        createdAt: this.faker.date.past({ years: 1 }).toISOString(),
        updatedAt: this.faker.datatype.boolean() ? this.faker.date.recent({ days: 30 }).toISOString() : undefined,
        verified: this.faker.datatype.boolean(),
        reply: hasReply ? this.faker.lorem.sentences(2) : undefined,
        repliedAt: hasReply ? this.faker.date.recent({ days: 7 }).toISOString() : undefined,

      } satisfies ProductReview;

      reviews.push(review);
    }

    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort reviews by created date descending
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

    const reviews = this.createReviewsForProduct(query.product);
    if (reviews.length === 0) {
      // If there are no reviews, return a summary with averageRating 0 and totalRatings 0
      const emptySummary = this.createEmptyProductRatingSummary({ product: query.product });
      return success(emptySummary);
    }

    const totalRatings = reviews.length;
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / (totalRatings || 1);

    const ratingDistribution = {
      '1': reviews.filter(x => x.rating === 1).length,
      '2': reviews.filter(x => x.rating === 2).length,
      '3': reviews.filter(x => x.rating === 3).length,
      '4': reviews.filter(x => x.rating === 4).length,
      '5': reviews.filter(x => x.rating === 5).length,
    };

    const summary: ProductRatingSummary = {
      identifier: {
        product: query.product,
      },
      averageRating,
      totalRatings,
      ratingDistribution,
    };

    return success(summary);
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
    const pageSize = query.paginationOptions?.pageSize ?? 20;
    const pageNumber = query.paginationOptions?.pageNumber ?? 1;

    const reviews = this.createReviewsForProduct(query.product);

    const returnedReviews = reviews.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    const paginatedResult: ProductReviewPaginatedResult = {
      items: returnedReviews,
      totalCount: reviews.length,
      pageSize,
      pageNumber,
      totalPages: Math.ceil(reviews.length / Math.max(pageSize, 1)),
    };

    return success(paginatedResult);
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
    // For fake provider, we always succeed and return a fake review

    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return error<InvalidInputError>({ type: 'InvalidInput', error: 'Only registered users can submit reviews.' });
    }


    const review: ProductReview = {
      identifier: {
        key: this.faker.string.uuid(),
      },
      product: mutation.product,
      authorName: mutation.authorName,
      rating: mutation.rating,
      title: mutation.title,
      content: mutation.content,
      createdAt: new Date().toISOString(),
      verified: this.faker.datatype.boolean(),
    };

    return success(review);
  }
}
