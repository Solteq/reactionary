import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  InventorySchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclInventoryCapability } from '../capabilities/inventory.capability.js';
import { HclInventoryFactory } from '../factories/index.js';
import { HclTransactionClient } from '../core/transaction-client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

// Confirmed product SKU on www-latestdevauth.demo.solteq.io store 41.
const testData = {
  sku: 'DR-CHRS-0001-0001',
};

describe('HCL Inventory Capability', () => {
  let provider: HclInventoryCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const transactionClient = new HclTransactionClient(config);
    provider = new HclInventoryCapability(
      new NoOpCache(),
      reqCtx,
      config,
      transactionClient,
      new HclInventoryFactory(InventorySchema),
    );
  });

  it('should return inventory for a SKU (online)', async () => {
    const result = await provider.getBySKU({
      variant: { sku: testData.sku },
      fulfilmentCenter: { key: '' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    expect(result.value.identifier.variant.sku).toBe(testData.sku);
    expect(result.value.quantity).toBeGreaterThanOrEqual(0);
    expect([
      'inStock',
      'outOfStock',
      'onBackOrder',
      'preOrder',
      'discontinued',
    ]).toContain(result.value.status);
  });
});
