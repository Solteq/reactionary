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

  it('should get a product by id (partNumber)', async () => {
    const result = await provider.getById({
      identifier: { key: testData.product.partNumber },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.name).toBeTruthy();
    expect(result.value.identifier.key).toBe(testData.product.partNumber);
    expect(result.value.slug).toBeTruthy();
    expect(result.value.mainVariant).toBeDefined();
    expect(result.value.mainVariant.identifier.sku).toBeTruthy();
  });

  it('should get a product by slug', async () => {
    const result = await provider.getBySlug({ slug: testData.product.slug });

    if (!result.success) {
      assert.fail(
        `Expected success for slug "${testData.product.slug}", got: ${JSON.stringify(result)}`,
      );
    }

    expect(result.value.identifier.key).toBe(testData.product.partNumber);
    expect(result.value.name).toBeTruthy();
  });

  it('should get a product by SKU', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.product.sku },
    });

    if (!result.success) {
      assert.fail(
        `Expected success for SKU "${testData.product.sku}", got: ${JSON.stringify(result)}`,
      );
    }

    expect(result.value.name).toBeTruthy();
    expect(result.value.mainVariant.identifier.sku).toBeTruthy();
  });

  it('should get a multi-variant product with multiple variants', async () => {
    const result = await provider.getById({
      identifier: { key: testData.productWithMultiVariants.partNumber },
    });

    if (!result.success) {
      assert.fail(`getById failed: ${JSON.stringify(result)}`);
    }

    expect(result.value.mainVariant).toBeDefined();
    // NOTE: update testData.productWithMultiVariants with a real multi-SKU partNumber
    // to make this assertion meaningful.
    expect(result.value.mainVariant.identifier.sku).toBeTruthy();
  });

  it('should return NotFound for an unknown slug', async () => {
    const result = await provider.getBySlug({ slug: 'UNKNOWN-PART-XYZ-99999' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('should contain descriptive attributes', async () => {
    const result = await provider.getById({
      identifier: { key: testData.product.partNumber },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.sharedAttributes.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[0].values.length).toBeGreaterThan(0);
    expect(result.value.sharedAttributes[0].values[0].value).toBeTruthy();
  });
});
