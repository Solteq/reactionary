import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductRecommendationSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { HclProductRecommendationsFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
// Set HCL_ESPOTS_CONFIGURED=true in .test.env when the target server has the
// Reactionary_* espots configured. Algorithm tests are skipped when not set.
const espotsConfigured = !!process.env['HCL_ESPOTS_CONFIGURED'];
const testData = {
  product: { key: 'DR-CHRS-0001' },
  category: { key: 'DiningChairs' },
};

describe('HCL Product Recommendations Capability', () => {
  let provider: HclProductRecommendationsCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclProductRecommendationsCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProductRecommendationsFactory(ProductRecommendationSchema),
    );
  });

  describe('getRecommendations', () => {
    it.skipIf(!espotsConfigured)(
      'should return frequentlyBoughtTogether recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'frequentlyBoughtTogether',
          sourceProduct: testData.product,
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value.length).toBeLessThanOrEqual(4);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.key).toBeTruthy();
          expect(item.recommendationIdentifier.algorithm).toBe(
            'frequentlyBoughtTogether',
          );
          expect(item.recommendationReturnType).toBe('idOnly');
          if (item.recommendationReturnType === 'idOnly') {
            expect(item.product.key).toBeTruthy();
          }
        }
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return similar product recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'similar',
          sourceProduct: testData.product,
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.algorithm).toBe('similar');
        }
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return related product recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'related',
          sourceProduct: testData.product,
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.algorithm).toBe('related');
        }
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return trendingInCategory recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'trendingInCategory',
          sourceCategory: testData.category,
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.algorithm).toBe(
            'trendingInCategory',
          );
        }
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return popular product recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'popular',
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.algorithm).toBe('popular');
        }
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return topPicks product recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'topPicks',
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
      },
    );

    it.skipIf(!espotsConfigured)(
      'should return alsoViewed product recommendations',
      async () => {
        const result = await provider.getRecommendations({
          algorithm: 'alsoViewed',
          sourceProduct: testData.product,
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.algorithm).toBe('alsoViewed');
        }
      },
    );
  });

  describe('getCollection', () => {
    it.skipIf(!espotsConfigured)(
      'should return recommendations by named espot (collection)',
      async () => {
        const result = await provider.getCollection({
          collectionName: 'Reactionary_Popular',
          numberOfRecommendations: 4,
        });

        assert(
          result.success,
          `Expected success, got: ${JSON.stringify(result)}`,
        );
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value.length).toBeLessThanOrEqual(4);
        for (const item of result.value) {
          expect(item.recommendationIdentifier.key).toBeTruthy();
          expect(item.recommendationReturnType).toBe('idOnly');
        }
      },
    );

    it('should return empty array for a non-existent espot name', async () => {
      const result = await provider.getCollection({
        collectionName: 'NonExistentEspot_DoesNotExist',
        numberOfRecommendations: 4,
      });

      assert(
        result.success,
        `Expected success, got: ${JSON.stringify(result)}`,
      );
      expect(result.value).toEqual([]);
    });
  });
});
