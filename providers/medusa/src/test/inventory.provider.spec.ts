import { describe, it, expect, beforeEach, assert } from 'vitest';
import { MedusaInventoryProvider } from '../providers/inventory.provider.js';
import {
  InventorySchema,
  NoOpCache,
  createInitialRequestContext,
  type RequestContext,
} from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../core/client.js';

const testData = {
  skuInStock: '	4007249524126',
  skuOutOfStock: '4007249524645',
  fulfillmentCenter: 'European Warehouse',
};

// FIXME: Currently broken in terms of actually looking up anything...
describe('Medusa Inventory Provider', () => {
  let provider: MedusaInventoryProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaInventoryProvider(
      config,
      new NoOpCache(),
      reqCtx,
      client
    );
  });

  it('should be able to get inventory for a SKU with stock', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.skuInStock },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuInStock);
    expect(result.value.identifier.fulfillmentCenter.key).toBe(
      testData.fulfillmentCenter
    );
    expect(result.value.quantity).toBeGreaterThanOrEqual(0);
    if (result.value.quantity > 0) {
      expect(result.value.status).toBe('inStock');
    }
  });

  it('should return out of stock for a SKU without inventory', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.skuOutOfStock },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuOutOfStock);
    expect(result.value.identifier.fulfillmentCenter.key).toBe(
      testData.fulfillmentCenter
    );
    expect(result.value.quantity).toBe(0);
    expect(result.value.status).toBe('outOfStock');
  });

  it('should return placeholder inventory for an unknown SKU', async () => {
    const result = await provider.getBySKU({
      variant: { sku: 'unknown-sku' },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe('unknown-sku');
    expect(result.value.quantity).toBe(0);
    expect(result.value.status).toBe('outOfStock');
  });
});
