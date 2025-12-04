import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  PriceSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakePriceProvider } from '../providers/price.provider.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01-with-tiers',
};

describe('Fake Price Provider', () => {
  let provider: FakePriceProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakePriceProvider(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx
    );
  });

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getListPrice({
      variant: { sku: testData.skuWithoutTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBe('USD');
    expect(result.value.tieredPrices.length).toBe(0);
  });

  it('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getListPrice({
      variant: { sku: testData.skuWithTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBe('USD');
    expect(result.value.tieredPrices.length).toBeGreaterThan(0);

    expect(result.value.tieredPrices[0].minimumQuantity).toBeGreaterThan(0);
    expect(result.value.tieredPrices[0].price.value).toBeLessThanOrEqual(
      result.value.unitPrice.value
    );
    expect(result.value.tieredPrices[0].price.currency).toBe('USD');
  });

  it('should return a placeholder price for an unknown SKU', async () => {
    const result = await provider.getListPrice({
      variant: { sku: 'unknown-sku' },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe('unknown-sku');
    expect(result.value.unitPrice.value).toBe(-1);
    expect(result.value.unitPrice.currency).toBe('USD');
    expect(result.value.tieredPrices.length).toBe(0);
    expect(result.value.meta.placeholder).toBe(true);
  });
});
