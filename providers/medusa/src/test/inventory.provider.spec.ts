import { describe, it, expect, beforeEach } from 'vitest';
import { MedusaInventoryProvider } from '../providers/inventory.provider.js';
import { InventorySchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../core/client.js';

const testData = {
  skuInStock: '	4007249524126',
  skuOutOfStock: '4007249524645',
  fulfillmentCenter: 'European Warehouse'
}


// FIXME: Currently broken in terms of actually looking up anything...
describe('Medusa Inventory Provider', () => {
  let provider: MedusaInventoryProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaInventoryProvider(config, InventorySchema, new NoOpCache(), reqCtx, client);
  })

  it('should be able to get inventory for a SKU with stock', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.skuInStock },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuInStock);
      expect(result.identifier.fulfillmentCenter.key).toBe(testData.fulfillmentCenter);
      expect(result.quantity).toBeGreaterThanOrEqual(0);
      if (result.quantity > 0) {
        expect(result.status).toBe('inStock');
      }
      expect(result.meta?.placeholder).toBeDefined();
    }
  });

  it('should return out of stock for a SKU without inventory', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.skuOutOfStock },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuOutOfStock);
      expect(result.identifier.fulfillmentCenter.key).toBe(testData.fulfillmentCenter);
      expect(result.quantity).toBe(0);
      expect(result.status).toBe('outOfStock');
    }
  });

  it('should return placeholder inventory for an unknown SKU', async () => {
    const result = await provider.getBySKU({
      variant: { sku: 'unknown-sku' },
      fulfilmentCenter: { key: testData.fulfillmentCenter },
    });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe('unknown-sku');
      expect(result.quantity).toBe(0);
      expect(result.status).toBe('outOfStock');
      expect(result.meta?.placeholder).toBe(true);
    }
  });
});
