import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  product: {
    id: 'product_10959528',
    name: 'Manhattan 170703 cable accessory Cable kit',
    image: 'https://images.icecat.biz/img/norm/high/10959528-2837.jpg',
    sku: '0766623170703',
    slug: 'manhattan-170703-cable-accessory-cable-kit-10959528',
  },
  productWithMultiVariants: {
    slug: 'hp-gk859aa-mouse-office-bluetooth-laser-1600-dpi-1377612',
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
