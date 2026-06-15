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
  LipscoreProductsListSchema,
  LipscoreReviewsResponseSchema,
} from '../schema/lipscore.schema.js';
import type { LipscoreProductListItem } from '../schema/lipscore.schema.js';
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
    const product = await this.getProduct(query.product.key);

    return success(
      this.factory.parseRatingSummary(this.context, {
        productKey: query.product.key,
        votes: product?.votes ?? null,
        rating: product?.rating ?? null,
      }),
    );
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

    const product = await this.getProduct(query.product.key);

    if (product === null) {
      return success(
        this.factory.parseReviewPaginatedResult(this.context, {
          reviews: [],
          productKey: query.product.key,
          pageSize,
          pageNumber,
          totalReviewCount: 0,
        }),
      );
    }

    const reviews = await this.client.callGet(
      this.getReviewsUrl(product.id),
      this.getReviewsParams(pageSize, pageNumber),
      LipscoreReviewsResponseSchema,
    );

    return success(
      this.factory.parseReviewPaginatedResult(this.context, {
        reviews,
        productKey: query.product.key,
        pageSize,
        pageNumber,
        totalReviewCount: product.review_count ?? undefined,
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

  protected async getProduct(
    productKey: string,
  ): Promise<LipscoreProductListItem | null> {
    const params = this.getProductsParams(productKey);
    const products = await this.client.callGet(
      this.getProductsUrl(),
      params,
      LipscoreProductsListSchema,
    );
    return products[0] ?? null;
  }
  protected getProductsUrl(): string {
    return `${this.client.baseUrl}/products`;
  }
  protected getReviewsUrl(lipscoreProductId: number): string {
    return `${this.client.baseUrl}/products/${lipscoreProductId}/reviews`;
  }
  protected getProductsParams(productKey: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('internal_id', productKey);
    params.set('fields', 'rating,review_count');
    return params;
  }
  protected getReviewsParams(
    pageSize: number,
    pageNumber: number,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('page', String(pageNumber));
    params.set('per_page', String(pageSize));
    return params;
  }
}
