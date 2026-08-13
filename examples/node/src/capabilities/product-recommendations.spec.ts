import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  product: {
    id: 'product_4743891',
    name: 'Addit cable eater ø15/25 mm - mounting clips 902',
    image: 'https://images.icecat.biz/img/gallery/00ca65ba8dab0a84ed66b399aa9ec8c0.jpg',
    sku: '0805410339029',
    slug: 'addit-cable-eater-o15-25-mm-mounting-clips-902-4743891',
  },
};

describe.each([PrimaryProvider.MEDUSA])(
  'Product Recommendations - Collections - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to return a list of products for a collection', async () => {
      const result = await client.productRecommendations.getCollection({
        collectionName: 'newest-arrivals',
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBeGreaterThan(0);

      expect(result.value[0].recommendationReturnType).toBe('productSearchResultItem');
      if (result.value[0].recommendationReturnType === 'productSearchResultItem') {
        expect(result.value[0].product.identifier.key).toBeDefined();
        expect(result.value[0].product.name).toBeDefined();
        expect(result.value[0].product.slug).toBeDefined();
        expect(result.value[0].product.variants).toBeDefined();
        expect(result.value[0].product.variants.length).toBeGreaterThan(0);
        expect(result.value[0].product.variants[0].variant.sku).toBeDefined();
        expect(result.value[0].product.variants[0].image.sourceUrl).toBeDefined();
      }
    });

    it('should return an empty result for an unknown collection', async () => {
      const result = await client.productRecommendations.getCollection({
        collectionName: 'Unknown Collection',
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBe(0);
    });
  });


describe.each([PrimaryProvider.MEILISEARCH])(
  'Product Recommendations - Similar - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to return a list of products for recommendation - Similar ', async () => {
      const result = await client.productRecommendations.getRecommendations({
        algorithm: 'similar',
        sourceProduct: {
          key: testData.product.id,
        },
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value[0].recommendationReturnType).toBe('productSearchResultItem');
      if (result.value[0].recommendationReturnType === 'productSearchResultItem') {
        expect(result.value[0].product.identifier.key).toBeDefined();
        expect(result.value[0].product.name).toBeDefined();
        expect(result.value[0].product.slug).toBeDefined();
        expect(result.value[0].product.variants).toBeDefined();
        expect(result.value[0].product.variants.length).toBeGreaterThan(0);
        expect(result.value[0].product.variants[0].variant.sku).toBeDefined();
        expect(result.value[0].product.variants[0].image.sourceUrl).toBeDefined();
      }
      expect(result.value[0].recommendationIdentifier.key).toBeDefined();
    });

    it('should return an empty result for an unknown sku', async () => {
      const result = await client.productRecommendations.getRecommendations({
        algorithm: 'similar',
        sourceProduct: {
          key: 'unknown-product-id',
        },
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBe(0);
    });
  });



describe.each([PrimaryProvider.ALGOLIA])(
  'Product Recommendations - Related - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to return a list of products for recommendation - Related ', async () => {
      const result = await client.productRecommendations.getRecommendations({
        algorithm: 'related',
        sourceProduct: {
          key: testData.product.id,
        },
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value[0].recommendationReturnType).toBe('productSearchResultItem');
      if (result.value[0].recommendationReturnType === 'productSearchResultItem') {
        expect(result.value[0].product.identifier.key).toBeDefined();
        expect(result.value[0].product.name).toBeDefined();
        expect(result.value[0].product.slug).toBeDefined();
        expect(result.value[0].product.variants).toBeDefined();
        expect(result.value[0].product.variants.length).toBeGreaterThan(0);
        expect(result.value[0].product.variants[0].variant.sku).toBeDefined();
        expect(result.value[0].product.variants[0].image.sourceUrl).toBeDefined();
      }

    });

    it('should return an empty result for an unknown sku', async () => {
      const result = await client.productRecommendations.getRecommendations({
        algorithm: 'related',
        sourceProduct: {
          key: 'unknown-product-id',
        },
        numberOfRecommendations: 10,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.length).toBe(0);
    });
  });
