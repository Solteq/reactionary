import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

describe.each([PrimaryProvider.COMMERCETOOLS])('Inventory Capability', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
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
