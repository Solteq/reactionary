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
    // Expected resolved external category identifier (not a raw uniqueID or path string)
    parentCategoryKey: 'DiningChairs',
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

    expect(response.value.identifier.key).toBe(testData.product.sku);
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

  it('should return an error of NotFound for unknown id', async () => {
    const response = await client.product.getById({
      identifier: { key: 'UNKNOWN-PRODUCT-XXXX' },
    });

    if (response.success) {
      assert.fail();
    }

    expect(response.error.type).toBe('NotFound');
  });

  it('should return an error of NotFound for unknown sku', async () => {
    const response = await client.product.getBySKU({
      variant: { sku: 'UNKNOWN-SKU-XXXX' },
    });

    if (response.success) {
      assert.fail();
    }

    expect(response.error.type).toBe('NotFound');
  });

  it('should resolve parentCategories to external identifiers, not internal uniqueIDs or path strings', async () => {
    const response = await client.product.getById({
      identifier: { key: testData.product.id },
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }

    expect(response.value.parentCategories.length).toBeGreaterThan(0);

    for (const cat of response.value.parentCategories) {
      // Must not be a path string like "/10505/10507"
      expect(cat.key).not.toMatch(/^\//);
      // Must not be a raw numeric uniqueID like "10507"
      expect(cat.key).not.toMatch(/^\d+$/);
    }

    expect(response.value.parentCategories).toContainEqual(
      expect.objectContaining({ key: testData.product.parentCategoryKey }),
    );
  });
});
