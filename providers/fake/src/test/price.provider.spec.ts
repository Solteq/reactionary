import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { NoOpCache, PriceSchema, createInitialRequestContext } from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakePriceProvider } from '../providers/price.provider.js';
import { describe, expect, it, beforeEach } from 'vitest';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01-with-tiers'
}

describe('Fake Price Provider', () => {
  let provider: FakePriceProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    provider = new FakePriceProvider(getFakerTestConfiguration(), PriceSchema, new NoOpCache(), reqCtx);
  })

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithoutTiers }, type: 'List' });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });

  it('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithTiers }, type: 'List' });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBeGreaterThan(0);

      expect(result.tieredPrices[0].minimumQuantity).toBeGreaterThan(0);
      expect(result.tieredPrices[0].price.value).toBeLessThanOrEqual(result.unitPrice.value);
      expect(result.tieredPrices[0].price.currency).toBe('USD');

    }
  });

  it('should return a placeholder price for an unknown SKU', async () => {
    const result = await provider.getBySKU({ variant: { sku: 'unknown-sku' }, type: 'List'});

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe('unknown-sku');
      expect(result.unitPrice.value).toBe(-1);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
      expect(result.meta?.placeholder).toBe(true);
    }
  });

  it('can look up multiple prices at once', async () => {
    const skus = [testData.skuWithTiers, testData.skuWithoutTiers, 'unknown-sku'];
    const results = await Promise.all(skus.map( sku => provider.getBySKU({ variant: { sku: sku }, type: 'List'})));

    expect(results).toHaveLength(skus.length);
    expect(results[0].identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(results[1].identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(results[2].identifier.variant.sku).toBe('unknown-sku');
  });
});
