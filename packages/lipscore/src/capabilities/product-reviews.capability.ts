import {
  ProductReviewPaginatedResultSchema,
  ProductRatingSummarySchema,
  ProductReviewSchema,
  ProductReviewsCapability,
  Reactionary,
  error,
  success,
  type Cache,
  type InvalidInputError,
  type ProductReviewMutationSubmit,
  type ProductReviewsFactory,
  type ProductReviewsFactoryRatingOutput,
  type ProductReviewsFactoryReviewOutput,
  type ProductReviewsFactoryReviewPaginatedOutput,
  type ProductReviewsFactoryWithOutput,
  type ProductReviewsGetRatingSummaryQuery,
  type ProductReviewsListQuery,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import { LipscoreProductsResponseSchema } from '../schema/lipscore.schema.js';
import type { LipscoreConfiguration } from '../schema/configuration.schema.js';
import type { LipscoreClient } from '../core/client.js';
import type { LipscoreProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';

export class LipscoreProductReviewsCapability<
  TFactory extends ProductReviewsFactory = LipscoreProductReviewsFactory,
> extends ProductReviewsCapability<
  ProductReviewsFactoryRatingOutput<TFactory>,
  ProductReviewsFactoryReviewPaginatedOutput<TFactory>,
  ProductReviewsFactoryReviewOutput<TFactory>
> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: LipscoreConfiguration,
    protected readonly client: LipscoreClient,
    protected readonly factory: ProductReviewsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    outputSchema: ProductRatingSummarySchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getRatingSummary(
    query: ProductReviewsGetRatingSummaryQuery,
  ): Promise<Result<ProductReviewsFactoryRatingOutput<TFactory>>> {
    const response = await this.client.callGet(
      this.getReviewsUrl(),
      this.getRatingSummaryParams(query.product.key),
      LipscoreProductsResponseSchema,
    );

    return success(this.factory.parseRatingSummary(this.context, response));
  }

  @Reactionary({
    outputSchema: ProductReviewPaginatedResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 60,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async findReviews(
    query: ProductReviewsListQuery,
  ): Promise<Result<ProductReviewsFactoryReviewPaginatedOutput<TFactory>>> {
    const pageSize = query.paginationOptions?.pageSize ?? 10;
    const pageNumber = query.paginationOptions?.pageNumber ?? 1;

    const response = await this.client.callGet(
      this.getReviewsUrl(),
      this.getReviewsParams(query.product.key),
      LipscoreProductsResponseSchema,
    );

    return success(
      this.factory.parseReviewPaginatedResult(this.context, {
        response,
        productKey: query.product.key,
        pageSize,
        pageNumber,
      }),
    );
  }

  @Reactionary({
    outputSchema: ProductReviewSchema,
    cache: false,
    cacheTimeToLiveInSeconds: 0,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async submitReview(
    mutation: ProductReviewMutationSubmit,
  ): Promise<Result<ProductReviewsFactoryReviewOutput<TFactory>>> {
    void mutation;
    return error<InvalidInputError>({
      type: 'InvalidInput',
      error:
        'Review submission is handled via the Lipscore widget and is not available through this API.',
    });
  }

  // ---------------------------------------------------------------------------
  // Extension points — override in subclasses to customise API calls
  // ---------------------------------------------------------------------------

  protected getReviewsUrl(): string {
    return `${this.client.baseUrl}/products`;
  }

  protected getReviewsParams(productId: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('internal_id[]', productId);
    params.set('fields', 'reviews');
    return params;
  }

  protected getRatingSummaryParams(productId: string): URLSearchParams {
    return this.getReviewsParams(productId);
  }
}
