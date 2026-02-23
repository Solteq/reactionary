import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  product: {
    id: 'product_878198',
  },
};

describe.each([PrimaryProvider.FAKE, PrimaryProvider.COMMERCETOOLS])('Product Reviews', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('can get a rating summary for a product that has it', async () => {
    const result = await client.productReviews.getRatingSummary({
      product: { key: testData.product.id },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.averageRating).toBeGreaterThan(0);
    expect(result.value.totalRatings).toBeGreaterThan(0);
  });

  it('should return an empty result for an unknown product', async () => {
    const result = await client.productReviews.getRatingSummary({
      product: { key: 'unknown-product-id' },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.averageRating).toBe(0);
    expect(result.value.totalRatings).toBeUndefined();
  });

  it('can return a list of reviews for a product', async () => {
    const result = await client.productReviews.findReviews({
      product: { key: testData.product.id },
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeLessThanOrEqual(2);
    if (result.value.items.length > 0) {
      expect(result.value.items[0].identifier.key).toBeDefined();
      expect(result.value.items[0].authorName).toBeDefined();
      expect(result.value.items[0].rating).toBeGreaterThan(0);
      expect(result.value.items[0].content).toBeDefined();
    }
  });

  it('should return an empty list of reviews for an unknown product', async () => {
    const result = await client.productReviews.findReviews({
      product: { key: 'unknown-product-id' },
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }
    expect(result.value.items.length).toBe(0);
  });

  it('can paginate the list of reviews for a product', async () => {
    const firstPageResult = await client.productReviews.findReviews({
      product: { key: testData.product.id },
      paginationOptions: {
        pageNumber: 1,
        pageSize: 1,
      },
    });

    if (!firstPageResult.success) {
      assert.fail(JSON.stringify(firstPageResult.error));
    }

    expect(firstPageResult.value.items.length).toBe(1);
    const firstReview = firstPageResult.value.items[0];
    expect(firstReview.identifier.key).toBeDefined();

    const secondPageResult = await client.productReviews.findReviews({
      product: { key: testData.product.id },
      paginationOptions: {
        pageNumber: 2,
        pageSize: 1,
      },
    });

    if (!secondPageResult.success) {
      assert.fail(JSON.stringify(secondPageResult.error));
    }
  });

  describe('Submitting Reviews', () => {
    it('cannot submit review if not authenticated', async () => {
      const result = await client.productReviews.submitReview({
        product: { key: testData.product.id },
        rating: 4,
        title: 'Great product!',
        content: 'I really enjoyed using this product. Highly recommend it.',
        authorName: 'John Doe',
      });

      if (result.success) {
        assert.fail('Expected it to return an error for unauthenticated user');
      } else {
        expect(result.error.type).toBe('InvalidInput');
      }
    });

    it('can submit a review for a product', async () => {
      if (provider === PrimaryProvider.FAKE) {
        return;
      }
      const newIdentity = await client.identity.register({
        username: `testuser_${Date.now()}@example.com`,
        password: 'password123',
      });

      const result = await client.productReviews.submitReview({
        product: { key: testData.product.id },
        rating: 4,
        title: 'Great product!',
        content: 'I really enjoyed using this product. Highly recommend it.',
        authorName: 'John Doe',
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }
    });

    it('can submit a rating without review', async () => {
      const result = await client.productReviews.submitReview({
        product: { key: testData.product.id },
        rating: 5,
        title: '',
        content: '',
        authorName: 'Jane Doe',
      });
    });

    it('should return an error when submitting a review with invalid rating', async () => {
      const result = await client.productReviews.submitReview({
        product: { key: testData.product.id },
        rating: 6, // Invalid rating, should be between 1 and 5
        title: 'Invalid rating',
        content: 'This review has an invalid rating.',
        authorName: 'Invalid User',
      });

      if (result.success) {
        assert.fail('Expected it to return an error for invalid rating');
      } else {
        expect(result.error.type).toBe('InvalidInput');
      }
    });
  });
});
