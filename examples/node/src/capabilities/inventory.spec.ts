import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

describe.each([PrimaryProvider.COMMERCETOOLS])('Inventory Capability', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should return unavailable for unknown SKU', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: 'GMCT-01x',
      },
      fulfilmentCenter: {
        key: 'solteqPhysicalStore',
      },
    });

    expect(inventory.identifier.variant.sku).toBe('GMCT-01x');
    expect(inventory.identifier.fulfillmentCenter.key).toBe(
      'solteqPhysicalStore'
    );
    expect(inventory.status).toBe('outOfStock');
    expect(inventory.quantity).toBe(0);
    expect(inventory.meta.placeholder).toBe(true);
  });

  it('should return unavailable for unknown ffmcenter', async () => {
    const inventory = await client.inventory.getBySKU({
      variant: {
        sku: 'GMCT-01',
      },
      fulfilmentCenter: {
        key: 'unknown-ffmcenter',
      },
    });

    expect(inventory.identifier.variant.sku).toBe('GMCT-01');
    expect(inventory.identifier.fulfillmentCenter.key).toBe(
      'unknown-ffmcenter'
    );
    expect(inventory.status).toBe('outOfStock');
    expect(inventory.quantity).toBe(0);
    expect(inventory.meta.placeholder).toBe(true);

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

    expect(inventory.identifier.variant.sku).toBe('GMCT-01');
    expect(inventory.identifier.fulfillmentCenter.key).toBe(
      'solteqPhysicalStore'
    );
    expect(inventory.quantity).toBe(42);
  });
});
