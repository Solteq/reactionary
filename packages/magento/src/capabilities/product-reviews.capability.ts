import {
  ProductRatingSummarySchema,
  ProductReviewMutationSubmitSchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  ProductReviewsCapability,
  ProductReviewsGetRatingSummaryQuerySchema,
  ProductReviewsListQuerySchema,
  Reactionary,
  error,
  success,
  type Cache,
  type GenericError,
  type InvalidInputError,
  type NotFoundError,
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
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoCreateProductReviewRating,
  MagentoReviewableProduct,
} from '../schema/magento.types.js';
import { resolveProductSku } from '../utils/magento-product-lookup.js';

const debug = createDebug('reactionary:magento:product-reviews');

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_REVIEW_RATING_CODE = 'Rating';

/**
 * Magento's REST API carries no reviews or ratings at all, so this capability
 * talks to the GraphQL endpoint (`products.rating_summary`, `products.reviews`
 * and the `createProductReview` mutation) through {@link MagentoClient}.
 *
 * Two consequences of that schema are worth knowing about:
 *  - there is no per-star distribution, so `ratingDistribution` is undefined;
 *  - reviews have no identifier, so keys are derived (see `buildProductReviewKey`).
 */
export class MagentoProductReviewsCapability<
  TFactory extends ProductReviewsFactory = MagentoProductReviewsFactory,
> extends ProductReviewsCapability<
  ProductReviewsFactoryRatingOutput<TFactory>,
  ProductReviewsFactoryReviewPaginatedOutput<TFactory>,
  ProductReviewsFactoryReviewOutput<TFactory>
> {
  protected config: MagentoConfiguration;
  protected factory: ProductReviewsFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductReviewsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * The name of the Magento rating that carries the overall star score. Stores
   * can define several named ratings; override to pick a different one.
   */
  protected getReviewRatingCode(): string {
    return this.config.reviewRatingCode ?? DEFAULT_REVIEW_RATING_CODE;
  }

  protected async fetchRatingSummary(
    sku: string,
  ): Promise<MagentoReviewableProduct | null> {
    try {
      return await this.magentoApi.getProductReviewSummary(sku);
    } catch (err) {
      debug('Failed to load the rating summary for %s: %O', sku, err);
      return null;
    }
  }

  protected async fetchReviews(
    sku: string,
    pageSize: number,
    pageNumber: number,
  ): Promise<MagentoReviewableProduct | null> {
    try {
      return await this.magentoApi.getProductReviews(sku, pageSize, pageNumber);
    } catch (err) {
      // Magento rejects a currentPage past the end of the collection with a
      // GraphQL error rather than an empty page, which is not an error here.
      debug('Failed to load reviews for %s: %O', sku, err);
      return null;
    }
  }

  /**
   * Magento will not accept a star count directly — the rating has to be sent
   * as an opaque `value_id` looked up through `productReviewRatingsMetadata`.
   */
  protected async resolveRatingInput(
    rating: number,
  ): Promise<MagentoCreateProductReviewRating[] | null> {
    const metadata = await this.magentoApi.getProductReviewRatingsMetadata();
    const wantedCode = this.getReviewRatingCode().toLowerCase();
    const entry =
      metadata.find((item) => item.name.toLowerCase() === wantedCode) ??
      metadata[0];

    if (!entry) {
      return null;
    }

    const wantedValue = String(Math.round(rating));
    const value = entry.values.find((item) => item.value === wantedValue);
    if (!value) {
      return null;
    }

    return [{ id: entry.id, value_id: value.value_id }];
  }

  @Reactionary({
    inputSchema: ProductReviewsGetRatingSummaryQuerySchema,
    outputSchema: ProductRatingSummarySchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getRatingSummary(
    query: ProductReviewsGetRatingSummaryQuery,
  ): Promise<Result<ProductReviewsFactoryRatingOutput<TFactory>>> {
    const sku = await resolveProductSku(this.magentoApi, query.product.key);
    const product = sku ? await this.fetchRatingSummary(sku) : null;

    // An unresolvable product yields the empty summary rather than an error, so
    // that a product detail page can render without reviews.
    return success(
      this.factory.parseRatingSummary(this.context, {
        product: query.product,
        ratingSummary: product?.rating_summary,
        reviewCount: product?.review_count,
      }),
    );
  }

  @Reactionary({
    inputSchema: ProductReviewsListQuerySchema,
    outputSchema: ProductReviewPaginatedResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 60,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async findReviews(
    query: ProductReviewsListQuery,
  ): Promise<Result<ProductReviewsFactoryReviewPaginatedOutput<TFactory>>> {
    const pageSize = query.paginationOptions?.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageNumber = query.paginationOptions?.pageNumber ?? 1;

    const sku = await resolveProductSku(this.magentoApi, query.product.key);
    const product = sku
      ? await this.fetchReviews(sku, pageSize, pageNumber)
      : null;
    const reviews = product?.reviews?.items ?? [];

    return success(
      this.factory.parseReviewPaginatedResult(this.context, {
        product: query.product,
        sku: sku ?? query.product.key,
        reviews,
        totalCount: product?.review_count ?? reviews.length,
        pageSize,
        pageNumber,
      }),
    );
  }

  @Reactionary({
    inputSchema: ProductReviewMutationSubmitSchema,
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

    const sku = await resolveProductSku(this.magentoApi, mutation.product.key);
    if (!sku) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: mutation.product,
      });
    }

    const ratings = await this.resolveRatingInput(mutation.rating);
    if (!ratings) {
      return error<GenericError>({
        type: 'Generic',
        message: `Magento has no review rating "${this.getReviewRatingCode()}" with a value of ${mutation.rating}. Check the store's review rating configuration.`,
      });
    }

    const review = await this.magentoApi.createProductReview({
      sku,
      nickname: mutation.authorName,
      summary: mutation.title,
      text: mutation.content,
      ratings,
    });

    if (!review) {
      return error<GenericError>({
        type: 'Generic',
        message: `Magento accepted the review for ${sku} but returned no review payload.`,
      });
    }

    return success(
      this.factory.parseReview(this.context, {
        product: mutation.product,
        sku,
        review,
      }),
    );
  }
}
