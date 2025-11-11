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
    const result = await client.price.getBySKU({ variant: { sku: testData.skuWithoutTiers }, type: 'Offer' });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });

  it('should be able to get a list price for a sku', async () => {
    const result = await client.price.getBySKU({ variant: { sku: testData.skuWithoutTiers }, type: 'List' });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.unitPrice.value).toBeGreaterThan(0);
      expect(result.unitPrice.currency).toBe('USD');
      expect(result.tieredPrices.length).toBe(0);
    }
  });
});
