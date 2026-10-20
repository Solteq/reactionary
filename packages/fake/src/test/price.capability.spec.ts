import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  PriceSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakePriceCapability } from '../capabilities/price.capability.js';
import { FakePriceFactory } from '../factories/index.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01-with-tiers',
};

const nearestPriceEnding = (amount: number, endings: readonly number[]): number => {
  const wholeAmount = Math.floor(amount);
  const candidates = [wholeAmount, wholeAmount + 1].flatMap((whole) =>
    endings.map((ending) => whole + ending / 100),
  );
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate - amount) < Math.abs(closest - amount) ? candidate : closest,
  );
};

describe('Fake Price Provider', () => {
  let provider: FakePriceCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakePriceCapability(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      new FakePriceFactory(PriceSchema),
    );
  });

  it('should be able to get prices for a product without tiers', async () => {
    const result = await provider.getListPrice({
      variant: { sku: testData.skuWithoutTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe(testData.skuWithoutTiers);
    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
    expect(result.value.tieredPrices.length).toBe(0);
  });

  it('should be able to get prices for a product with tiers', async () => {
    const result = await provider.getListPrice({
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
    expect(result.value.tieredPrices[0].price.currency).toBe(reqCtx.languageContext.currencyCode);
  });

  it.each([
    { currency: 'DKK', rate: 6.56376981, endings: [0, 50, 95] },
    { currency: 'EUR', rate: 0.87803741, endings: [0, 90, 95] },
    { currency: 'NOK', rate: 9.51139889, endings: [0, 90] },
    { currency: 'SEK', rate: 9.92541411, endings: [0, 90] },
  ] as const)('should convert and apply $currency price endings', async ({ currency, rate, endings }) => {
    reqCtx.languageContext.currencyCode = 'USD';
    const usdResult = await provider.getListPrice({
      variant: { sku: testData.skuWithTiers },
    });
    if (!usdResult.success) {
      assert.fail();
    }

    reqCtx.languageContext.currencyCode = currency;

    const result = await provider.getListPrice({
      variant: { sku: testData.skuWithTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.unitPrice.currency).toBe(currency);
    expect(result.value.unitPrice.value).toBe(
      nearestPriceEnding(usdResult.value.unitPrice.value * rate, endings),
    );
    expect(result.value.tieredPrices[0].price.currency).toBe(currency);
    expect(result.value.tieredPrices[0].price.value).toBe(
      nearestPriceEnding(result.value.unitPrice.value * 0.8, endings),
    );
  });

  it('should round Icelandic króna prices to whole units', async () => {
    reqCtx.languageContext.currencyCode = 'USD';
    const usdResult = await provider.getListPrice({
      variant: { sku: testData.skuWithoutTiers },
    });
    if (!usdResult.success) {
      assert.fail();
    }

    reqCtx.languageContext.currencyCode = 'ISK';
    const result = await provider.getListPrice({
      variant: { sku: testData.skuWithoutTiers },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.unitPrice.currency).toBe('ISK');
    expect(result.value.unitPrice.value).toBe(
      Math.round(usdResult.value.unitPrice.value * 120.29041481),
    );
  });

  it('should return a placeholder price for an unknown SKU', async () => {
    const result = await provider.getListPrice({
      variant: { sku: 'unknown-sku' },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.variant.sku).toBe('unknown-sku');
    expect(result.value.unitPrice.value).toBe(-1);
    expect(result.value.unitPrice.currency).toBe(reqCtx.languageContext.currencyCode);
    expect(result.value.tieredPrices.length).toBe(0);
  });
});
