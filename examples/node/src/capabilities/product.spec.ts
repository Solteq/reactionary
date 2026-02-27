import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

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

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])(
  'Product Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to get a product by id', async () => {
      const response = await client.product.getById({
        identifier: { key: testData.product.id },
      });

      if (!response.success) {
        assert.fail();
      }

      expect(response.value.identifier.key).toBe(testData.product.id);
      expect(response.value.name).toBe(testData.product.name);
      expect(response.value.mainVariant.images[0].sourceUrl).toBe(
        testData.product.image
      );
      expect(response.value.mainVariant.name).toBeTruthy();
    });

    it('should be able to get a product by slug', async () => {
      const response = await client.product.getBySlug({
        slug: testData.product.slug,
      });

      if (!response.success) {
        assert.fail();
      }

      expect(response.value.identifier.key).toBe(testData.product.id);
      expect(response.value.name).toBe(testData.product.name);
      expect(response.value.mainVariant.images[0].sourceUrl).toBe(
        testData.product.image
      );
    });

    it('should be able to get a multivariant product by slug', async () => {
      const response = await client.product.getBySlug({
        slug: testData.productWithMultiVariants.slug,
      });

      if (!response.success) {
        assert.fail();
      }

      expect(response.value.identifier.key).toBeTruthy();
      expect(response.value.slug).toBe(testData.productWithMultiVariants.slug);
      expect(response.value.mainVariant).toBeDefined();
      expect(response.value.variants.length).toBeGreaterThan(0);
      expect(response.value.variants[0].identifier.sku).toBeTruthy();
      expect(response.value.variants[0].identifier.sku).not.toBe(
        response.value.mainVariant.identifier.sku
      );
      expect(response.value.sharedAttributes.length).toBeGreaterThan(1);
      expect(response.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
      expect(response.value.sharedAttributes[1].values[0].value).toBeTruthy();
    });

    it('should be able to get a product by sku', async () => {
      const response = await client.product.getBySKU({
        variant: { sku: testData.product.sku },
      });

      if (!response.success) {
        assert.fail();
      }

      expect(response.value.identifier.key).toBe(testData.product.id);
      expect(response.value.name).toBe(testData.product.name);
      expect(response.value.mainVariant.images[0].sourceUrl).toBe(
        testData.product.image
      );
    });

    it('should contain both product level and variant level attributes', async () => {
      const response = await client.product.getBySKU({
        variant: { sku: testData.product.sku },
      });

      if (!response.success) {
        assert.fail();
      }

      expect(response.value.sharedAttributes.length).toBeGreaterThan(1);
      expect(response.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
      expect(response.value.sharedAttributes[1].values[0].value).toBeTruthy();
    });

    it('should return an error of NotFound for unknown slug', async () => {
      const response = await client.product.getBySlug({ slug: 'unknown-slug' });

      if (response.success) {
        assert.fail();
      }

      expect(response.error.type).toBe('NotFound');
    });
  }
);
