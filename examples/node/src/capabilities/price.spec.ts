import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  skuWithoutTiers: '4049699458101',
};


describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.FAKE, PrimaryProvider.MEDUSA])(
  'Price Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    it('should be able to get an offer price for a sku', async () => {
      const result = await client.price.getCustomerPrice({
        variant: { sku: testData.skuWithoutTiers },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.identifier.variant.sku).toBe(
        testData.skuWithoutTiers
      );
      expect(result.value.unitPrice.value).toBeDefined();
      expect(result.value.unitPrice.currency).toBe('EUR');
      expect(result.value.tieredPrices.length).toBe(0);
    });

    it('should be able to get a list price for a sku', async () => {
      const result = await client.price.getListPrice({
        variant: { sku: testData.skuWithoutTiers },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.identifier.variant.sku).toBe(testData.skuWithoutTiers);
      expect(result.value.unitPrice.value).toBeDefined();
      expect(result.value.unitPrice.currency).toBe('EUR');
      expect(result.value.tieredPrices.length).toBe(0);
    });
  }
);

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])('Price Capability - Multicurrency - %s', (provider) => {
  let client: ReturnType<typeof createClient>;


    it('can get monetary values in other currencies', async () => {
      client = createClient(provider, {
        languageContext: {
          locale: 'en-US',
          currencyCode: 'USD',
        },
      });

      const result = await client.price.getListPrice({
        variant: { sku: testData.skuWithoutTiers},
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      const altLanguageClient = createClient(provider, {
        languageContext: {
          locale: 'en-US',
          currencyCode: 'EUR',
        },
      });

      const altResult = await altLanguageClient.price.getListPrice({
        variant: { sku: testData.skuWithoutTiers },
      });

      if (!altResult.success) {
        assert.fail(JSON.stringify(altResult.error));
      }
      const firstItem = result.value;
      const altFirstItem = altResult.value;

      // we check that the name is different and hope the same product is in both test sets
      expect(altFirstItem.unitPrice.currency).toBe('EUR');
      expect(firstItem.unitPrice.currency).toBe('USD');
      expect(altFirstItem.unitPrice.value).toBeTruthy();
      expect(altFirstItem.unitPrice.value).not.toBe(firstItem.unitPrice.value);
    });
  },
);
