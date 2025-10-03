import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  InventorySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils';
import { CommercetoolsInventoryProvider } from '../providers/inventory.provider';

describe('Commercetools Inventory Provider', () => {
  let provider: CommercetoolsInventoryProvider;
  let reqCtx: RequestContext;

  beforeAll(() => {
    provider = new CommercetoolsInventoryProvider(
      getCommercetoolsTestConfiguration(),
      InventorySchema,
      new NoOpCache()
    );
  });

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
  });

  it('should be able to fetch inventory for a given SKU and Fulfillment Center', async () => {
    const inventory = await provider.getBySKU({
        sku: {
            key: 'GMCT-01'
        },
        fulfilmentCenter: {
            key: 'solteqPhysicalStore'
        }
    }, reqCtx);

    expect(inventory.identifier.sku.key).toBe('GMCT-01');
    expect(inventory.identifier.fulfillmentCenter.key).toBe('solteqPhysicalStore');
    expect(inventory.quantity).toBe(42);
  });
});
