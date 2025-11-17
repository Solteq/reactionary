import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MedusaPriceProvider } from '../providers/price.provider.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { PriceSchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../core/client.js';

const testData = {
  skuWithoutTiers: '8712581327934',
  skuWithTiers: '8710895937641'
}


// FIXME: Currently broken in terms of actually looking up anything...
describe('Medusa Price Provider', () => {
  let provider: MedusaPriceProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaPriceProvider(config, PriceSchema, new NoOpCache(), reqCtx, client);
  })

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithoutTiers }});

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
      expect(result.tieredPrices.length).toBe(0);
    }
  });

  it.skip('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getBySKU({ variant: { sku: testData.skuWithTiers }});

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
      expect(result.tieredPrices.length).toBeGreaterThan(0);

      expect(result.tieredPrices[0].minimumQuantity).toBeGreaterThan(0);
      expect(result.tieredPrices[0].price.value).toBeLessThanOrEqual(result.unitPrice.value);
      expect(result.tieredPrices[0].price.currency).toBe(reqCtx.languageContext.currencyCode);

    }
  });

  it('should return a placeholder price for an unknown SKU', async () => {
    const result = await provider.getBySKU({ variant: { sku: 'unknown-sku' }});

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe('unknown-sku');
      expect(result.unitPrice.value).toBe(-1);
      expect(result.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
      expect(result.tieredPrices.length).toBe(0);
      expect(result.meta?.placeholder).toBe(true);
    }
  });

  it('can look up multiple prices at once', async () => {
    const skus = [testData.skuWithTiers, testData.skuWithoutTiers, 'unknown-sku'];
    const results = await Promise.all(skus.map( sku => provider.getBySKU({ variant: { sku: sku }})));

    expect(results).toHaveLength(skus.length);
    expect(results[0].identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(results[0].unitPrice.value).toBeGreaterThan(0);
    expect(results[1].identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(results[1].unitPrice.value).toBeGreaterThan(0);
    expect(results[2].identifier.variant.sku).toBe('unknown-sku');
  });
});


