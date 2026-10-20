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
import { PRODUCT_REVIEW_STORE_CONFIG_QUERY } from '../core/product-reviews.graphql.js';
import type { MagentoProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoCreateProductReviewRating,
  MagentoReviewableProduct,
} from '../schema/magento.types.js';
import type { MagentoProductReviewStoreConfigResult } from '../schema/product-reviews.types.js';
import {
  handleMagentoLookupError,
  MagentoLookupNotFoundError,
  requireProductSku,
} from '../utils/magento-product-lookup.js';

const debug = createDebug('reactionary:magento:product-reviews');

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_REVIEW_RATING_CODE = 'Rating';

/**
 * Magento's REST API carries no reviews or ratings at all, so this capability
 * talks to the GraphQL endpoint (`products.rating_summary`, `products.reviews`
 * and the `createProductReview` mutation) through {@link MagentoClient}.
 *
 * Consequences of that schema worth knowing about:
 *  - there is no per-star distribution, so `ratingDistribution` is undefined;
 *  - there is no verified-purchase flag, so `verified` is always false;
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

  /**
   * The product's rating summary, or null when no product with this SKU is
   * visible in the current store view. Transport failures are thrown.
   */
  protected async fetchRatingSummary(
    sku: string,
  ): Promise<MagentoReviewableProduct | null> {
    return this.magentoApi.getProductReviewSummary(sku);
  }

  /**
   * A page of the product's reviews, or null when no product with this SKU is
   * visible in the current store view. Transport failures are thrown.
   */
  protected async fetchReviews(
    sku: string,
    pageSize: number,
    pageNumber: number,
  ): Promise<MagentoReviewableProduct | null> {
    try {
      return await this.magentoApi.getProductReviews(sku, pageSize, pageNumber);
    } catch (err) {
      // Magento rejects a currentPage past the end of the collection with a
      // GraphQL error rather than an empty page; that is an empty page here.
      if (isPageOutOfRangeError(err)) {
        debug('Review page %d is past the end for %s', pageNumber, sku);
        return { sku, reviews: { items: [] } };
      }
      throw err;
    }
  }

  /**
   * Whether the store accepts reviews from guests
   * (`catalog/review/allow_guest`), read from the GraphQL `storeConfig`.
   */
  protected async allowsGuestReviews(): Promise<boolean> {
    const result =
      await this.magentoApi.graphqlRequest<MagentoProductReviewStoreConfigResult>(
        PRODUCT_REVIEW_STORE_CONFIG_QUERY,
      );
    const flag = result.storeConfig?.allow_guests_to_write_product_reviews;
    return flag === '1' || flag === 'true';
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
    try {
      const sku = await requireProductSku(this.magentoApi, query.product.key);
      const product = await this.fetchRatingSummary(sku);
      if (!product) {
        throw new MagentoLookupNotFoundError('product', query.product.key);
      }

      return success(
        this.factory.parseRatingSummary(this.context, {
          product: query.product,
          ratingSummary: product.rating_summary,
          reviewCount: product.review_count,
        }),
      );
    } catch (err) {
      return handleMagentoLookupError('load the rating summary', err, query.product);
    }
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

    try {
      const sku = await requireProductSku(this.magentoApi, query.product.key);
      const product = await this.fetchReviews(sku, pageSize, pageNumber);
      if (!product) {
        throw new MagentoLookupNotFoundError('product', query.product.key);
      }
      const reviews = product.reviews?.items ?? [];

      return success(
        this.factory.parseReviewPaginatedResult(this.context, {
          product: query.product,
          sku,
          reviews,
          totalCount: product.review_count ?? reviews.length,
          pageSize,
          pageNumber,
        }),
      );
    } catch (err) {
      return handleMagentoLookupError('load reviews', err, query.product);
    }
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
    try {
      if (this.context.session.identityContext.identity.type !== 'Registered') {
        const guestsAllowed = await this.allowsGuestReviews();
        if (!guestsAllowed) {
          return error<InvalidInputError>({
            type: 'InvalidInput',
            error: 'This store only accepts reviews from registered customers.',
          });
        }
      }

      const sku = await requireProductSku(this.magentoApi, mutation.product.key);

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
    } catch (err) {
      return handleMagentoLookupError('submit the review', err, mutation.product);
    }
  }
}

/** Magento's answer to a `reviews(currentPage:)` beyond the last page. */
function isPageOutOfRangeError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /currentPage value \d+ specified is greater than the number of pages available/i.test(
      err.message,
    )
  );
}
