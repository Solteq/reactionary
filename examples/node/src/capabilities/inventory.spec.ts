import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  existingSKU: '0766623360203',
  existingFulfillmentCenter: {
    [PrimaryProvider.MEDUSA]: 'European Warehouse',
    [PrimaryProvider.COMMERCETOOLS]: 'solteqPhysicalStore',
  }
}
describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])('Inventory Capability', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should return NotFound for unknown SKU', async () => {
    const p: string = provider + '' as string;
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: testData.existingSKU + '-unknown',
      },
      fulfilmentCenter: {
        key: testData.existingFulfillmentCenter[ provider === PrimaryProvider.MEDUSA ? PrimaryProvider.MEDUSA : PrimaryProvider.COMMERCETOOLS ],
      },
    });

    if (inventory.success) {
      assert.fail(JSON.stringify(inventory.value));
    }

    expect(inventory.error.type).toBe('NotFound');
  });

  it('should return NotFound for unknown ffmcenter', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: testData.existingSKU,
      },
      fulfilmentCenter: {
        key: 'unknown-ffmcenter',
      },
    });

    if (inventory.success) {
      assert.fail(JSON.stringify(inventory.value));
    }

    expect(inventory.error.type).toBe('NotFound');
  });

  it('should be able to fetch inventory for a given SKU and Fulfillment Center', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: testData.existingSKU,
      },
      fulfilmentCenter: {
        key: testData.existingFulfillmentCenter[ provider === PrimaryProvider.MEDUSA ? PrimaryProvider.MEDUSA : PrimaryProvider.COMMERCETOOLS ],
      },
    });

    if (!inventory.success) {
      assert.fail(JSON.stringify(inventory.error));
    }

    expect(inventory.value.identifier.variant.sku).toBe(testData.existingSKU);
    expect(inventory.value.identifier.fulfillmentCenter.key).toBe(
      testData.existingFulfillmentCenter[ provider === PrimaryProvider.MEDUSA ? PrimaryProvider.MEDUSA : PrimaryProvider.COMMERCETOOLS ]
    );
    expect(inventory.value.quantity).toBeGreaterThan(0);
  });
});
