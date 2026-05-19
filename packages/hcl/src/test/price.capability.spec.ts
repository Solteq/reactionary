import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  PriceSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclPriceCapability } from '../capabilities/price.capability.js';
import { HclPriceFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

// Confirmed product on www-latestdevauth.demo.solteq.io store 41.
const testData = {
  sku: 'DR-CHRS-0001-0001',
};

describe('HCL Price Capability', () => {
  let provider: HclPriceCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclPriceCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclPriceFactory(PriceSchema),
    );
  });

  it('should get a list price for a SKU', async () => {
    const result = await provider.getListPrice({
      variant: { sku: testData.sku },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBeTruthy();
    expect(result.value.identifier.variant.sku).toBe(testData.sku);
    expect(result.value.onSale).toBe(false);
    expect(result.value.tieredPrices).toEqual([]);
  });

  it('should get a customer price for a SKU', async () => {
    const result = await provider.getCustomerPrice({
      variant: { sku: testData.sku },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    expect(result.value.unitPrice.value).toBeGreaterThan(0);
    expect(result.value.unitPrice.currency).toBeTruthy();
    expect(result.value.identifier.variant.sku).toBe(testData.sku);
  });
});
