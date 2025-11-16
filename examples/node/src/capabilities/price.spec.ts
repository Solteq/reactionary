import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  skuWithoutTiers: '4049699458101'
}


// FIXME: Currently broken in terms of actually looking up anything...
describe.each([PrimaryProvider.COMMERCETOOLS])('Price Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should be able to get an offer price for a sku', async () => {
    const result = await client.price.getCustomerPrice({ variant: { sku: testData.skuWithoutTiers } });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBe(155.1);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });

  it('should be able to get a list price for a sku', async () => {
    const result = await client.price.getListPrice({ variant: { sku: testData.skuWithoutTiers } });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(200);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });
});
