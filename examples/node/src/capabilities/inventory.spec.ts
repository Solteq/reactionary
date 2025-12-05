import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

describe.each([PrimaryProvider.COMMERCETOOLS])('Inventory Capability', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should return NotFound for unknown SKU', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: 'GMCT-01x',
      },
      fulfilmentCenter: {
        key: 'solteqPhysicalStore',
      },
    });

    if (inventory.success) {
      assert.fail();
    }

    expect(inventory.error.type).toBe('NotFound');
  });

  it('should return NotFound for unknown ffmcenter', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: 'GMCT-01',
      },
      fulfilmentCenter: {
        key: 'unknown-ffmcenter',
      },
    });

    if (inventory.success) {
      assert.fail();
    }

    expect(inventory.error.type).toBe('NotFound');
  });

  it('should be able to fetch inventory for a given SKU and Fulfillment Center', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: 'GMCT-01',
      },
      fulfilmentCenter: {
        key: 'solteqPhysicalStore',
      },
    });

    if (!inventory.success) {
      assert.fail();
    }

    expect(inventory.value.identifier.variant.sku).toBe('GMCT-01');
    expect(inventory.value.identifier.fulfillmentCenter.key).toBe(
      'solteqPhysicalStore'
    );
    expect(inventory.value.quantity).toBe(42);
  });
});
