import 'dotenv/config';

import type { RequestContext} from '@reactionary/core';
import { NoOpCache, PriceSchema, createInitialRequestContext,} from '@reactionary/core';
import {   getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsPriceProvider } from '../providers/price.provider.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

const testData = {
  skuWithoutTiers: '8719514465190',
  skuWithTiers: '8719514435377',
}


// FIXME: Currently broken in terms of actually looking up anything...
describe.skip('Commercetools Price Provider', () => {
  let provider: CommercetoolsPriceProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config).getClient(reqCtx);
    
    provider = new CommercetoolsPriceProvider(config, PriceSchema, new NoOpCache(), reqCtx, client);
  })

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithoutTiers }});

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });

  it.skip('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithTiers }});

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
    const result = await provider.getBySKU({ variant: { sku: 'unknown-sku' }});

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
    const results = await Promise.all(skus.map( sku => provider.getBySKU({ variant: { sku: sku }})));

    expect(results).toHaveLength(skus.length);
    expect(results[0].identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(results[1].identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(results[2].identifier.variant.sku).toBe('unknown-sku');
  });
});
