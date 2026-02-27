import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { ProductSearchQueryCreateNavigationFilter } from '@reactionary/core';

const testData = {
  productWithAssociations: {
    id: 'product_102456',
  },
  productWithoutAssociations: {
    id: 'product_100201',
  },
};

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])(
  'Product Associations - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    describe('Accessories', () => {
      it('should be able to return a list of accessories for a product that has them', async () => {
        const result = await client.productAssociations.getAccessories({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfAccessories: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBeGreaterThan(0);
        const firstResult = result.value[0];
        expect(firstResult.associationReturnType).toBe('productSearchResultItem');
        if (firstResult.associationReturnType === 'productSearchResultItem') {
          expect(firstResult.product.identifier.key).toBeDefined();
          expect(firstResult.product.name).toBeDefined();
          expect(firstResult.product.slug).toBeDefined();
          expect(firstResult.product.variants).toBeDefined();
          expect(firstResult.product.variants.length).toBeGreaterThan(0);
          expect(firstResult.product.variants[0].variant.sku).toBeDefined();
          expect(firstResult.product.variants[0].image.sourceUrl).toBeDefined();
        }
      });

      it('can return a subset of the full list', async () => {
        const result = await client.productAssociations.getAccessories({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfAccessories: 2,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(2);
      });


      it('should return an empty list for a product that has no accessories', async () => {
        const result = await client.productAssociations.getAccessories({
          forProduct: { key: testData.productWithoutAssociations.id },
          numberOfAccessories: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });

      it('should return an empty result for an unknown product', async () => {
        const result = await client.productAssociations.getAccessories({
          forProduct: {
            key: 'unknown-product-id',
          },
          numberOfAccessories: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });
    });



    describe('Spareparts', () => {
      it('should be able to return a list of spareparts for a product that has them', async () => {
        const result = await client.productAssociations.getSpareparts({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfSpareparts: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBeGreaterThan(0);
        const firstResult = result.value[0];
        expect(firstResult.associationReturnType).toBe('productSearchResultItem');
        if (firstResult.associationReturnType === 'productSearchResultItem') {
          expect(firstResult.product.identifier.key).toBeDefined();
          expect(firstResult.product.name).toBeDefined();
          expect(firstResult.product.slug).toBeDefined();
          expect(firstResult.product.variants).toBeDefined();
          expect(firstResult.product.variants.length).toBeGreaterThan(0);
          expect(firstResult.product.variants[0].variant.sku).toBeDefined();
          expect(firstResult.product.variants[0].image.sourceUrl).toBeDefined();
        }
      });

      it('can return a subset of the full list', async () => {
        const result = await client.productAssociations.getSpareparts({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfSpareparts: 1,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(1);
      });


      it('should return an empty list for a product that has no spareparts', async () => {
        const result = await client.productAssociations.getSpareparts({
          forProduct: { key: testData.productWithoutAssociations.id },
          numberOfSpareparts: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });

      it('should return an empty result for an unknown product', async () => {
        const result = await client.productAssociations.getSpareparts({
          forProduct: {
            key: 'unknown-product-id',
          },
          numberOfSpareparts: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });
    });




    describe('Replacements', () => {
      it.skip('should be able to return a list of replacements for a product that has them', async () => {
        const result = await client.productAssociations.getReplacements({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfReplacements: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBeGreaterThan(0);
        const firstResult = result.value[0];
        expect(firstResult.associationReturnType).toBe('productSearchResultItem');
        if (firstResult.associationReturnType === 'productSearchResultItem') {
          expect(firstResult.product.identifier.key).toBeDefined();
          expect(firstResult.product.name).toBeDefined();
          expect(firstResult.product.slug).toBeDefined();
          expect(firstResult.product.variants).toBeDefined();
          expect(firstResult.product.variants.length).toBeGreaterThan(0);
          expect(firstResult.product.variants[0].variant.sku).toBeDefined();
          expect(firstResult.product.variants[0].image.sourceUrl).toBeDefined();
        }
      });

      it.skip('can return a subset of the full list', async () => {
        const result = await client.productAssociations.getReplacements({
          forProduct: { key: testData.productWithAssociations.id },
          numberOfReplacements: 1,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(1);
      });


      it('should return an empty list for a product that has no replacements', async () => {
        const result = await client.productAssociations.getReplacements({
          forProduct: { key: testData.productWithoutAssociations.id },
          numberOfReplacements: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });

      it('should return an empty result for an unknown product', async () => {
        const result = await client.productAssociations.getReplacements({
          forProduct: {
            key: 'unknown-product-id',
          },
          numberOfReplacements: 4,
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        expect(result.value.length).toBe(0);
      });
    });

  });
