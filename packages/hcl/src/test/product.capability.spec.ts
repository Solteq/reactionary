import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createHclClient } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
const testData = {
  product: {
    id: 'DR-CHRS-0001',
    name: 'Wooden Dining Chair',
    sku: 'DR-CHRS-0001-0001',
    slug: 'wooden-dining-chair-dr-chrs-0001',
  },
  productWithMultiVariants: {
    slug: 'wooden-dining-chair-dr-chrs-0001',
  },
};

describe('HCL Product Capability', () => {
  let client: ReturnType<typeof createHclClient>;

  beforeEach(() => {
    client = createHclClient();
  });

  it('should be able to get a product by id', async () => {
    const response = await client.product.getById({
      identifier: { key: testData.product.id },
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.identifier.key).toBe(testData.product.id);
    expect(response.value.name).toBe(testData.product.name);
    expect(response.value.mainVariant).toBeDefined();
    expect(response.value.mainVariant.identifier.sku).toBeTruthy();
  });

  it('should be able to get a product by slug', async () => {
    const response = await client.product.getBySlug({
      slug: testData.product.slug,
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.identifier.key).toBe(testData.product.id);
    expect(response.value.name).toBe(testData.product.name);
  });

  it('should be able to get a multivariant product by slug', async () => {
    const response = await client.product.getBySlug({
      slug: testData.productWithMultiVariants.slug,
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.identifier.key).toBeTruthy();
    expect(response.value.slug).toBe(testData.productWithMultiVariants.slug);
    expect(response.value.mainVariant).toBeDefined();
    expect(response.value.variants.length).toBeGreaterThan(0);
    expect(response.value.variants[0].identifier.sku).toBeTruthy();
  });

  it('should be able to get a product by sku', async () => {
    const response = await client.product.getBySKU({
      variant: { sku: testData.product.sku },
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.identifier.key).toBe(testData.product.id);
    expect(response.value.name).toBe(testData.product.name);
  });

  it('should contain both product level and variant level attributes', async () => {
    const response = await client.product.getBySKU({
      variant: { sku: testData.product.sku },
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.sharedAttributes.length).toBeGreaterThan(0);
    expect(response.value.sharedAttributes[0].values.length).toBeGreaterThan(0);
    expect(response.value.sharedAttributes[0].values[0].value).toBeTruthy();
  });

  it('should return an error of NotFound for unknown slug', async () => {
    const response = await client.product.getBySlug({ slug: 'unknown-slug' });

    if (response.success) {
      assert.fail();
    }

    expect(response.error.type).toBe('NotFound');
  });
});

// Confirmed product on www-latestdevauth.demo.solteq.io store 41.
// DR-CHRS-0001 ("Wooden Dining Chair") has Descriptive attributes and multiple SKUs.
const testData = {
  product: {
    partNumber: 'DR-CHRS-0001',
    slug: 'wooden-dining-chair-dr-chrs-0001',
    sku: 'DR-CHRS-0001-0001',
  },
  productWithMultiVariants: {
    partNumber: 'DR-CHRS-0001',
    slug: 'wooden-dining-chair-dr-chrs-0001',
  },
};
