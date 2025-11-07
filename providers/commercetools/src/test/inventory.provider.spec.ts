import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  InventorySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsInventoryProvider } from '../providers/inventory.provider.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

describe('Commercetools Inventory Provider', () => {
  let provider: CommercetoolsInventoryProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config, reqCtx);

    provider = new CommercetoolsInventoryProvider(
      config,
      InventorySchema,
      new NoOpCache(),
      reqCtx,
      client
    );
  });

  it.skip('should be able to fetch inventory for a given SKU and Fulfillment Center', async () => {
    const inventory = await provider.getBySKU({
        variant: {
            sku: 'GMCT-01'
        },
        fulfilmentCenter: {
            key: 'solteqPhysicalStore'
        }
    });

    expect(inventory.identifier.variant.sku).toBe('GMCT-01');
    expect(inventory.identifier.fulfillmentCenter.key).toBe('solteqPhysicalStore');
    expect(inventory.quantity).toBe(42);
  });
});
