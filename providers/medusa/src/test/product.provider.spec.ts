import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { MedusaProductProvider } from '../providers/product.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';
import { MedusaClient } from '../index.js';

const testData = {
  product: {
    name: 'LV-CA31 SCART Cable',
    slug: 'lv-ca31-scart-cable-101080',
    image: 'https://images.icecat.biz/img/norm/high/101080-3513.jpg',
    sku: '4960999194479',
  },
  productWithMultiVariants: {
    slug: 'hp-gk859aa-mouse-office-bluetooth-laser-1600-dpi-1377612',
  },
};

describe('Medusa Product Provider', () => {
  let provider: MedusaProductProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const client = new MedusaClient(getMedusaTestConfiguration(), reqCtx);
    provider = new MedusaProductProvider(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      client
    );
  });

  it('should be able to get a product by id', async () => {
    const slugResult = await provider.getBySlug({
      slug: testData.product.slug,
    });

    if (!slugResult.success) {
      assert.fail();
    }

    const result = await provider.getById({
      identifier: slugResult.value.identifier,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe(slugResult.value.identifier.key);
    expect(result.value.name).toBe(testData.product.name);

    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.mainVariant.identifier.sku).toBe(testData.product.sku);
    expect(result.value.mainVariant.images[0].sourceUrl).toBe(
      testData.product.image
    );
    expect(result.value.sharedAttributes.length).toBeGreaterThan(1);
    expect(result.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[1].values[0].value).toBeTruthy();
  });

  it('should be able to get a product with multiple variants by slug', async () => {
    const result = await provider.getBySlug({
      slug: testData.productWithMultiVariants.slug,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBeTruthy();
    expect(result.value.slug).toBe(testData.productWithMultiVariants.slug);
    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.variants.length).toBeGreaterThan(0);
    expect(result.value.variants[0].identifier.sku).toBeTruthy();
    expect(result.value.variants[0].identifier.sku).not.toBe(
      result.value.mainVariant.identifier.sku
    );
    expect(result.value.sharedAttributes.length).toBeGreaterThan(1);
    expect(result.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[1].values[0].value).toBeTruthy();
  });

  it('should be able to get a product by sku', async () => {
    const slugResult = await provider.getBySlug({
      slug: testData.product.slug,
    });

    if (!slugResult.success) {
      assert.fail();
    }

    const result = await provider.getBySKU({
      variant: { sku: testData.product.sku },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe(slugResult.value.identifier.key);
    expect(result.value.name).toBe(testData.product.name);
    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.mainVariant.identifier.sku).toBe(testData.product.sku);
    expect(result.value.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
    expect(result.value.sharedAttributes.length).toBeGreaterThan(1);
    expect(result.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[1].values[0].value).toBeTruthy();
  });

  it('should return null for unknown slug', async () => {
    const result = await provider.getBySlug({ slug: 'unknown-slug' });

    expect(result).toBeNull();
  });

  it('should contain both product level and variant level attributes', async () => {
    const result = await provider.getBySlug({ slug: testData.product.slug });
    
    if (!result.success) {
      assert.fail();
    }

    expect(result.value.sharedAttributes.length).toBeGreaterThan(1);
    expect(result.value.sharedAttributes[1].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[1].values[0].value).toBeTruthy();
  });

  it('should return a placeholder product for unknown id', async () => {
    const result = await provider.getById({
      identifier: { key: 'unknown-id' },
    });

    if (!result.success) {
      assert.fail();
    }
  });
});
