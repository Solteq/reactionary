import type { RequestContext } from '@reactionary/core';
import { NoOpCache, OrderSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoOrderCapability } from '../capabilities/order.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoOrderFactory } from '../factories/order/order.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

const SAMPLE_RAW_ORDER = {
  entity_id: 42,
  increment_id: '000000042',
  customer_id: 7,
  customer_email: 'shopper@example.com',
  status: 'processing',
  state: 'processing',
  created_at: '2026-08-20T10:00:00Z',
  order_currency_code: 'EUR',
  grand_total: 100,
  subtotal: 90,
  shipping_amount: 10,
  discount_amount: 0,
  tax_amount: 0,
  items: [{ item_id: 1, sku: 'SKU-1', qty_ordered: 1, price: 90, row_total: 90 }],
  billing_address: {
    firstname: 'Jane',
    lastname: 'Doe',
    street: ['Main St 1'],
    city: 'Tallinn',
    postcode: '10111',
    country_id: 'EE',
    telephone: '5551234',
    email: 'shopper@example.com',
  },
  payment: { method: 'checkmo', amount_ordered: 100 },
};

describe('MagentoOrderCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: { getOrderById: ReturnType<typeof vi.fn> };
  let capability: MagentoOrderCapability;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = { getOrderById: vi.fn() };
    capability = new MagentoOrderCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoOrderFactory(OrderSchema),
    );
  });

  it('returns the parsed order when Magento finds it', async () => {
    magentoApi.getOrderById.mockResolvedValue(SAMPLE_RAW_ORDER);

    const result = await capability.getById({ order: { key: '42' } });

    expect(magentoApi.getOrderById).toHaveBeenCalledWith('42');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.identifier.key).toBe('42');
      expect(result.value.items).toHaveLength(1);
    }
  });

  it('returns a NotFound error when Magento has no such order', async () => {
    magentoApi.getOrderById.mockResolvedValue(undefined);

    const result = await capability.getById({ order: { key: '999' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'NotFound', identifier: { key: '999' } });
    }
  });
});
