import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoProduct, MagentoProductReview } from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const SAMPLE_REVIEW: MagentoProductReview = {
  average_rating: 80,
  created_at: '2026-08-20 10:00:00',
  nickname: 'Jane',
  summary: 'Great product!',
  text: 'I really enjoyed using this product.',
  ratings_breakdown: [{ name: 'Rating', value: '4' }],
};

const RATINGS_METADATA = [
  {
    id: 'MQ==',
    name: 'Rating',
    values: [
      { value_id: 'MQ==', value: '1' },
      { value_id: 'Mg==', value: '2' },
      { value_id: 'Mw==', value: '3' },
      { value_id: 'NA==', value: '4' },
      { value_id: 'NQ==', value: '5' },
    ],
  },
];

function createFactory() {
  return new MagentoProductReviewsFactory(
    ProductRatingSummarySchema,
    ProductReviewSchema,
    ProductReviewPaginatedResultSchema,
  );
}

describe('MagentoProductReviewsFactory', () => {
  const factory = createFactory();
  const context = createInitialRequestContext();

  it('converts the percentage rating summary onto the 0-5 star scale', () => {
    const summary = factory.parseRatingSummary(context, {
      product: { key: 'product_1' },
      ratingSummary: 80,
      reviewCount: 12,
    });

    expect(summary.averageRating).toBe(4);
    expect(summary.totalRatings).toBe(12);
    // Magento's GraphQL schema has no per-star breakdown.
    expect(summary.ratingDistribution).toBeUndefined();
  });

  it('returns an empty summary when Magento knows nothing about the product', () => {
    const summary = factory.parseRatingSummary(context, {
      product: { key: 'unknown-product-id' },
      ratingSummary: undefined,
      reviewCount: undefined,
    });

    expect(summary.averageRating).toBe(0);
    expect(summary.totalRatings).toBeUndefined();
  });

  it('maps a raw Magento review onto the core ProductReview shape', () => {
    const review = factory.parseReview(context, {
      product: { key: 'product_1' },
      sku: 'SKU-1',
      review: SAMPLE_REVIEW,
    });

    expect(review.rating).toBe(4);
    expect(review.authorName).toBe('Jane');
    expect(review.title).toBe('Great product!');
    expect(review.content).toBe('I really enjoyed using this product.');
    expect(review.createdAt).toBe('2026-08-20T10:00:00.000Z');
    // Magento exposes no verified-purchase flag.
    expect(review.verified).toBe(false);
  });

  it('derives a review key that is stable and independent of the page', () => {
    const first = factory.parseReview(context, {
      product: { key: 'product_1' },
      sku: 'SKU-1',
      review: SAMPLE_REVIEW,
    });
    const again = factory.parseReview(context, {
      product: { key: 'product_1' },
      sku: 'SKU-1',
      review: SAMPLE_REVIEW,
    });
    const other = factory.parseReview(context, {
      product: { key: 'product_1' },
      sku: 'SKU-1',
      review: { ...SAMPLE_REVIEW, nickname: 'John' },
    });

    expect(first.identifier.key).toBeTruthy();
    expect(first.identifier.key).toBe(again.identifier.key);
    expect(first.identifier.key).not.toBe(other.identifier.key);
  });

  it('derives the page count from the total review count', () => {
    const page = factory.parseReviewPaginatedResult(context, {
      product: { key: 'product_1' },
      sku: 'SKU-1',
      reviews: [SAMPLE_REVIEW],
      totalCount: 5,
      pageSize: 2,
      pageNumber: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.totalCount).toBe(5);
    expect(page.totalPages).toBe(3);
  });
});

describe('MagentoProductReviewsCapability', () => {
  let reqCtx: RequestContext;
  let client: MagentoClient;
  let capability: MagentoProductReviewsCapability;

  const product = (sku: string): MagentoProduct => ({ id: 1, sku, name: sku });

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    client = new MagentoClient(config, reqCtx);
    // resolveProductSku goes through the catalogue search to map the
    // reactionary product key onto a Magento SKU.
    vi.spyOn(client, 'searchProducts').mockResolvedValue({
      items: [product('SKU-1')],
      total_count: 1,
    });
    vi.spyOn(client, 'getProductReviewRatingsMetadata').mockResolvedValue(
      RATINGS_METADATA,
    );
    capability = new MagentoProductReviewsCapability(
      config,
      new NoOpCache(),
      reqCtx,
      client,
      createFactory(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function registerIdentity() {
    reqCtx.session.identityContext.identity = {
      type: 'Registered',
      id: { userId: 'customer-1' },
    };
  }

  function guestReviewsAllowed(allowed: boolean) {
    return vi.spyOn(client, 'graphqlRequest').mockResolvedValue({
      storeConfig: { allow_guests_to_write_product_reviews: allowed ? '1' : '0' },
    });
  }

  const submission = {
    product: { key: 'product_1' },
    rating: 4,
    title: 'Great product!',
    content: 'I really enjoyed using this product.',
    authorName: 'Jane',
  };

  it('returns the rating summary for a product that has reviews', async () => {
    const summary = vi.spyOn(client, 'getProductReviewSummary').mockResolvedValue({
      sku: 'SKU-1',
      rating_summary: 90,
      review_count: 3,
    });

    const result = await capability.getRatingSummary({
      product: { key: 'product_1' },
    });

    expect(summary).toHaveBeenCalledWith('SKU-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.averageRating).toBe(4.5);
      expect(result.value.totalRatings).toBe(3);
    }
  });

  it('returns NotFound for a product key that does not resolve', async () => {
    vi.spyOn(client, 'searchProducts').mockResolvedValue({ items: [], total_count: 0 });
    const summary = vi.spyOn(client, 'getProductReviewSummary');

    const result = await capability.getRatingSummary({
      product: { key: 'unknown-product-id' },
    });

    expect(summary).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns NotFound when the product is not visible in the store view', async () => {
    vi.spyOn(client, 'getProductReviewSummary').mockResolvedValue(null);

    const result = await capability.getRatingSummary({
      product: { key: 'product_1' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a Generic error instead of an empty summary when Magento fails', async () => {
    vi.spyOn(client, 'getProductReviewSummary').mockRejectedValue(
      new MagentoApiError({
        transport: 'graphql',
        status: 500,
        method: 'POST',
        url: 'https://example.com/graphql',
      }),
    );

    const result = await capability.getRatingSummary({
      product: { key: 'product_1' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('passes the pagination options through to Magento', async () => {
    const reviews = vi.spyOn(client, 'getProductReviews').mockResolvedValue({
      sku: 'SKU-1',
      review_count: 3,
      reviews: { items: [SAMPLE_REVIEW] },
    });

    const result = await capability.findReviews({
      product: { key: 'product_1' },
      paginationOptions: { pageNumber: 2, pageSize: 1 },
    });

    expect(reviews).toHaveBeenCalledWith('SKU-1', 1, 2);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.pageNumber).toBe(2);
      expect(result.value.totalCount).toBe(3);
    }
  });

  it('returns an empty page when Magento rejects the requested page', async () => {
    vi.spyOn(client, 'getProductReviews').mockRejectedValue(
      new Error('currentPage value 99 specified is greater than the number of pages available.'),
    );

    const result = await capability.findReviews({
      product: { key: 'product_1' },
      paginationOptions: { pageNumber: 99, pageSize: 1 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.items).toHaveLength(0);
      expect(result.value.totalCount).toBe(0);
    }
  });

  it('returns a Generic error when loading reviews fails for another reason', async () => {
    vi.spyOn(client, 'getProductReviews').mockRejectedValue(new Error('socket hang up'));

    const result = await capability.findReviews({
      product: { key: 'product_1' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('rejects a guest review when the store requires registration', async () => {
    guestReviewsAllowed(false);
    const create = vi.spyOn(client, 'createProductReview');

    const result = await capability.submitReview(submission);

    expect(create).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  it('accepts a guest review when the store allows guest reviews', async () => {
    guestReviewsAllowed(true);
    const create = vi
      .spyOn(client, 'createProductReview')
      .mockResolvedValue(SAMPLE_REVIEW);

    const result = await capability.submitReview(submission);

    expect(create).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('rejects a rating outside the 1-5 range', async () => {
    registerIdentity();
    const create = vi.spyOn(client, 'createProductReview');

    const result = await capability.submitReview({ ...submission, rating: 6 });

    expect(create).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  it('resolves the rating value_id from the store metadata before submitting', async () => {
    registerIdentity();
    const create = vi
      .spyOn(client, 'createProductReview')
      .mockResolvedValue(SAMPLE_REVIEW);

    const result = await capability.submitReview(submission);

    expect(create).toHaveBeenCalledWith({
      sku: 'SKU-1',
      nickname: 'Jane',
      summary: 'Great product!',
      text: 'I really enjoyed using this product.',
      ratings: [{ id: 'MQ==', value_id: 'NA==' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.rating).toBe(4);
    }
  });

  it('returns NotFound when submitting a review for an unknown product', async () => {
    registerIdentity();
    vi.spyOn(client, 'searchProducts').mockResolvedValue({ items: [], total_count: 0 });
    const create = vi.spyOn(client, 'createProductReview');

    const result = await capability.submitReview(submission);

    expect(create).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a typed error when Magento rejects the review', async () => {
    registerIdentity();
    vi.spyOn(client, 'createProductReview').mockRejectedValue(
      new MagentoApiError({
        transport: 'graphql',
        status: 200,
        method: 'POST',
        url: 'https://example.com/graphql',
        graphqlErrors: [
          { message: 'Invalid input', extensions: { category: 'graphql-input' } },
        ],
      }),
    );

    const result = await capability.submitReview(submission);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  it('fails with a descriptive error when the store has no matching rating', async () => {
    registerIdentity();
    vi.spyOn(client, 'getProductReviewRatingsMetadata').mockResolvedValue([]);
    const create = vi.spyOn(client, 'createProductReview');

    const result = await capability.submitReview(submission);

    expect(create).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });
});
