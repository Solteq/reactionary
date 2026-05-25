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
import {
  BvReviewsResponseSchema,
  BvStatisticsResponseSchema,
  BvSubmitReviewResponseSchema,
} from '../schema/bazaarvoice.schema.js';
import type { BazaarvoiceConfiguration } from '../schema/configuration.schema.js';
import type { BazaarvoiceClient } from '../core/client.js';
import type { BazaarvoiceProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';

export class BazaarvoiceProductReviewsCapability<
  TFactory extends ProductReviewsFactory = BazaarvoiceProductReviewsFactory,
> extends ProductReviewsCapability<
  ProductReviewsFactoryRatingOutput<TFactory>,
  ProductReviewsFactoryReviewPaginatedOutput<TFactory>,
  ProductReviewsFactoryReviewOutput<TFactory>
> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: BazaarvoiceConfiguration,
    protected readonly client: BazaarvoiceClient,
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
      this.getStatisticsUrl(),
      this.getStatisticsParams(query.product.key),
      BvStatisticsResponseSchema,
    );

    if (response.HasErrors || response.Results.length === 0) {
      return success(
        this.createEmptyProductRatingSummary({
          product: query.product,
        }) as ProductReviewsFactoryRatingOutput<TFactory>,
      );
    }

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
    const offset = (pageNumber - 1) * pageSize;

    const response = await this.client.callGet(
      this.getReviewsUrl(),
      this.getReviewsParams(query.product.key, pageSize, offset),
      BvReviewsResponseSchema,
    );

    // Override Limit/Offset with the values we requested — BV may echo back its
    // own default limit (10) regardless of what was sent.
    return success(
      this.factory.parseReviewPaginatedResult(this.context, {
        ...response,
        Limit: pageSize,
        Offset: offset,
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
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Only registered users can submit reviews.',
      });
    }

    const response = await this.client.callPost(
      this.getSubmitReviewUrl(),
      this.getSubmitReviewBody(mutation),
      BvSubmitReviewResponseSchema,
    );

    if (response.HasErrors || !response.Review) {
      const fieldErrors = response.FormErrors?.FieldErrors
        ? Object.values(response.FormErrors.FieldErrors)
            .map((e) => e.Message)
            .join('; ')
        : (response.Errors?.[0]?.Message ?? 'Review submission failed.');
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: fieldErrors,
      });
    }

    return success(this.factory.parseReview(this.context, response.Review));
  }

  // ---------------------------------------------------------------------------
  // Extension points — override in subclasses to customise API calls
  // ---------------------------------------------------------------------------

  protected getStatisticsUrl(): string {
    return `${this.client.baseUrl}/data/statistics.json`;
  }

  protected getStatisticsParams(productId: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('Filter', `ProductId:eq:${productId}`);
    params.set('stats', 'Reviews');
    return params;
  }

  protected getReviewsUrl(): string {
    return `${this.client.baseUrl}/data/reviews.json`;
  }

  protected getReviewsParams(
    productId: string,
    limit: number,
    offset: number,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('Filter', `ProductId:eq:${productId}`);
    params.set('Limit', String(limit));
    params.set('Offset', String(offset));
    params.set('Sort', 'SubmissionTime:desc');
    return params;
  }

  protected getSubmitReviewUrl(): string {
    return `${this.client.baseUrl}/data/submitreview.json`;
  }

  protected getSubmitReviewBody(
    mutation: ProductReviewMutationSubmit,
  ): URLSearchParams {
    const body = new URLSearchParams();
    body.set('Action', 'Submit');
    body.set('ProductId', mutation.product.key);
    body.set('Rating', String(mutation.rating));
    body.set('Title', mutation.title);
    body.set('ReviewText', mutation.content);
    body.set('UserNickname', mutation.authorName);
    return body;
  }
}
