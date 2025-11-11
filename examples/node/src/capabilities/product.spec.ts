import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient } from '../utils.js';

const testData = {
  product: {
    id: 'product_10959528',
    name: 'Manhattan 170703 cable accessory Cable kit',
    image: 'https://images.icecat.biz/img/norm/high/10959528-2837.jpg',
    sku: '0766623170703',
    slug: 'manhattan-170703-cable-accessory-cable-kit-10959528',
  },
};

describe('Product Capability', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
  });

  it('should be able to get a product by id', async () => {
    const result = await client.product.getById({ id: testData.product.id });

    expect(result).toBeTruthy();
    expect(result.identifier.key).toBe(testData.product.id);
    expect(result.meta.placeholder).toBe(false);
    expect(result.name).toBe(testData.product.name);
    expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
  });

  it('should be able to get a product by slug', async () => {
    const result = await client.product.getBySlug({ slug: testData.product.slug });

    expect(result).toBeTruthy();

    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant.images[0].sourceUrl).toBe(
        testData.product.image
      );
    }
  });

  it('should be able to get a product by sku', async () => {
    const result = await client.product.getBySKU({
      variant: { sku: testData.product.sku },
    });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant.images[0].sourceUrl).toBe(
        testData.product.image
      );
    }
  });

  it('should return null for unknown slug', async () => {
    const result = await client.product.getBySlug({ slug: 'unknown-slug' });

    expect(result).toBeNull();
  });

  it('should return a placeholder product for unknown id', async () => {
    const result = await client.product.getById({ id: 'unknown-id' });

    expect(result).toBeTruthy();
    expect(result.meta.placeholder).toBe(true);
  });
});
