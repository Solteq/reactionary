import { describe, it, expect, beforeEach, vi, assert } from 'vitest';
import { MedusaPriceProvider } from '../providers/price.provider.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  PriceSchema,
  NoOpCache,
  createInitialRequestContext,
  type RequestContext,
} from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../core/client.js';

const testData = {
  skuWithoutTiers: '8712581327934',
  skuWithTiers: '8710895937641',
};

// FIXME: Currently broken in terms of actually looking up anything...
describe('Medusa Price Provider', () => {
  let provider: MedusaPriceProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaPriceProvider(config, new NoOpCache(), reqCtx, client);
  });

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getCustomerPrice({
      variant: { sku: testData.skuWithoutTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBe(
      reqCtx.languageContext.currencyCode
    );
    expect(result.value.tieredPrices.length).toBe(0);
  });

  it.skip('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getCustomerPrice({
      variant: { sku: testData.skuWithTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
    expect(result.value.tieredPrices.length).toBeGreaterThan(0);

    expect(result.value.tieredPrices[0].minimumQuantity).toBeGreaterThan(0);
    expect(result.value.tieredPrices[0].price.value).toBeLessThanOrEqual(
      result.value.unitPrice.value
    );
    expect(result.value.tieredPrices[0].price.currency).toBe(
      reqCtx.languageContext.currencyCode
    );
  });

  it('should return NotFound for an unknown SKU', async () => {
    const result = await provider.getCustomerPrice({
      variant: { sku: 'unknown-sku' },
    });

    if (result.success) {
      assert.fail();
    }
  });

  it('can look up multiple prices at once', async () => {
    const skus = [
      testData.skuWithTiers,
      testData.skuWithoutTiers,
      'unknown-sku',
    ];
    const results = await Promise.all(
      skus.map((sku) => provider.getCustomerPrice({ variant: { sku: sku } }))
    );

    const success = results.filter(x => x.success);

    if (results.length !== success.length) {
      assert.fail();
    }

    expect(success).toHaveLength(skus.length);
    expect(success[0].value.identifier.variant.sku).toBe(testData.skuWithTiers);
    expect(success[0].value.unitPrice.value).toBeGreaterThan(0);
    expect(success[1].value.identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(success[1].value.unitPrice.value).toBeGreaterThan(0);
    expect(success[2].value.identifier.variant.sku).toBe('unknown-sku');
  });
});
