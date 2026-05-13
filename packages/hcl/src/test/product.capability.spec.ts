import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclProductCapability } from '../capabilities/product.capability.js';
import { HclProductFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

// TODO: Update partNumbers once the HCL instance is confirmed.
// Using ICECAT part numbers shared across all providers as placeholders.
const testData = {
  product: {
    name: 'LV-CA31 SCART Cable',
    partNumber: 'LV-CA31',
    sku: '4960999194479',
  },
  productWithMultiVariants: {
    partNumber: 'GK859AA',
  },
};

describe('HCL Product Provider', () => {
  let provider: HclProductCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config);
    provider = new HclProductCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProductFactory(ProductSchema),
    );
  });

  it('should get a product by slug (partNumber)', async () => {
    const result = await provider.getBySlug({
      slug: testData.product.partNumber,
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.name).toBe(testData.product.name);
    expect(result.value.slug).toBeTruthy();
    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.mainVariant.identifier.sku).toBeTruthy();
    expect(result.value.sharedAttributes.length).toBeGreaterThan(0);
  });

  it('should get a product by id', async () => {
    const slugResult = await provider.getBySlug({
      slug: testData.product.partNumber,
    });

    if (!slugResult.success) {
      assert.fail('getBySlug failed');
    }

    const result = await provider.getById({
      identifier: slugResult.value.identifier,
    });

    if (!result.success) {
      assert.fail('getById failed');
    }

    expect(result.value.identifier.key).toBe(slugResult.value.identifier.key);
    expect(result.value.name).toBe(testData.product.name);
  });

  it('should get a product by SKU', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.product.sku },
    });

    if (!result.success) {
      assert.fail('getBySKU failed');
    }

    expect(result.value.name).toBe(testData.product.name);
    expect(result.value.mainVariant.identifier.sku).toBe(testData.product.sku);
  });

  it('should get a multi-variant product with multiple variants', async () => {
    const result = await provider.getBySlug({
      slug: testData.productWithMultiVariants.partNumber,
    });

    if (!result.success) {
      assert.fail('getBySlug for multi-variant product failed');
    }

    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.variants.length).toBeGreaterThan(0);
    expect(result.value.variants[0].identifier.sku).toBeTruthy();
    expect(result.value.variants[0].identifier.sku).not.toBe(
      result.value.mainVariant.identifier.sku,
    );
  });

  it('should return NotFound for an unknown partNumber', async () => {
    const result = await provider.getBySlug({ slug: 'UNKNOWN-PART-XYZ-99999' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('should contain descriptive attributes', async () => {
    const result = await provider.getBySlug({
      slug: testData.product.partNumber,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.sharedAttributes.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[0].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[0].values[0].value).toBeTruthy();
  });
});
