// Bazaarvoice Conversations REST API v5.4
// Credentials: BV_PASS_KEY (required), BV_API_URL (optional, defaults to staging or prod)
import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { BazaarvoiceProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { BazaarvoiceProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import { BazaarvoiceClient } from '../core/client.js';
import {
  ProductRatingSummarySchema,
  ProductReviewSchema,
  ProductReviewPaginatedResultSchema,
} from '@reactionary/core';
import type { BazaarvoiceConfiguration } from '../schema/configuration.schema.js';

// Update these to match a product that exists in your BV account
const testData = {
  productId: process.env['BV_TEST_PRODUCT_ID'] ?? 'DR-CHRS-0001',
};

function getBazaarvoiceTestConfiguration(): BazaarvoiceConfiguration {
  const passKey = process.env['BV_PASS_KEY'];
  if (!passKey) {
    throw new Error(
      'BV_PASS_KEY environment variable is required for integration tests.',
    );
  }
  return {
    passKey,
    apiUrl: process.env['BV_API_URL'] ?? 'https://stg.api.bazaarvoice.com',
    apiVersion: '5.4',
  };
}

describe('BazaarvoiceProductReviewsCapability', () => {
  let provider: BazaarvoiceProductReviewsCapability;

  beforeEach(() => {
    const config = getBazaarvoiceTestConfiguration();
    const reqCtx = createInitialRequestContext();
    const client = new BazaarvoiceClient(config, reqCtx);
    provider = new BazaarvoiceProductReviewsCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new BazaarvoiceProductReviewsFactory(
        ProductRatingSummarySchema,
        ProductReviewSchema,
        ProductReviewPaginatedResultSchema,
      ),
    );
  });

  it('getRatingSummary — returns a valid rating summary', async () => {
    const result = await provider.getRatingSummary({
      product: { key: testData.productId },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    if (result.value.totalRatings !== undefined && result.value.totalRatings > 0) {
      // Product has reviews
      expect(result.value.averageRating).toBeGreaterThan(0);
      expect(result.value.averageRating).toBeLessThanOrEqual(5);
      expect(result.value.totalRatings).toBeGreaterThan(0);
    } else {
      // Product has no reviews — should return a valid empty summary
      expect(result.value.averageRating).toBe(0);
      expect(result.value.totalRatings).toBeUndefined();
    }
  });

  it('getRatingSummary — returns empty summary for unknown product', async () => {
    const result = await provider.getRatingSummary({
      product: { key: 'DOES-NOT-EXIST-XYZ-123' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.averageRating).toBe(0);
    expect(result.value.totalRatings).toBeUndefined();
  });

  it('findReviews — returns paginated review list', async () => {
    const result = await provider.findReviews({
      product: { key: testData.productId },
      paginationOptions: { pageSize: 5, pageNumber: 1 },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    expect(Array.isArray(result.value.items)).toBe(true);
    expect(result.value.items.length).toBeLessThanOrEqual(5);
    expect(result.value.pageSize).toBe(5);
    expect(result.value.pageNumber).toBe(1);
    // totalPages may be 0 when the product has no reviews
    expect(result.value.totalPages).toBeGreaterThanOrEqual(0);

    for (const review of result.value.items) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(typeof review.title).toBe('string');
      expect(typeof review.content).toBe('string');
      expect(typeof review.createdAt).toBe('string');
    }
  });

  it('findReviews — second page differs from first', async () => {
    const page1 = await provider.findReviews({
      product: { key: testData.productId },
      paginationOptions: { pageSize: 2, pageNumber: 1 },
    });
    const page2 = await provider.findReviews({
      product: { key: testData.productId },
      paginationOptions: { pageSize: 2, pageNumber: 2 },
    });

    assert(page1.success, `Expected success, got: ${JSON.stringify(page1)}`);
    assert(page2.success, `Expected success, got: ${JSON.stringify(page2)}`);

    if (page1.value.totalPages > 1 && page2.value.items.length > 0) {
      const page1Ids = page1.value.items.map((r) => r.identifier.key);
      const page2Ids = page2.value.items.map((r) => r.identifier.key);
      expect(page1Ids).not.toEqual(page2Ids);
    }
  });

  it('submitReview — rejects unauthenticated users', async () => {
    const result = await provider.submitReview({
      product: { key: testData.productId },
      rating: 4,
      title: 'Great product',
      content: 'Really enjoying it.',
      authorName: 'Test User',
    });

    // Context is unauthenticated (guest) — should return an error
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });
});
