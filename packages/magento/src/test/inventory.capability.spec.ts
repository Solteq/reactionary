import type { RequestContext } from '@reactionary/core';
import { InventorySchema, NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoInventoryCapability } from '../capabilities/inventory.capability.js';
import { MagentoClient, RequestContextTokenStore } from '../core/client.js';
import { MagentoInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoSourceItem } from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'admin-token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MagentoInventoryCapability.getBySKUAcrossFulfillmentCenters', () => {
  let reqCtx: RequestContext;
  let capability: MagentoInventoryCapability;
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    capability = new MagentoInventoryCapability(
      config,
      new NoOpCache(),
      reqCtx,
      new MagentoClient(config, reqCtx),
      new MagentoInventoryFactory(InventorySchema),
    );
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns one inventory per MSI source for the SKU', async () => {
    const items: MagentoSourceItem[] = [
      { sku: 'SKU-1', source_code: 'store_a', quantity: 5, status: 1 },
      { sku: 'SKU-1', source_code: 'store_b', quantity: 0, status: 0 },
    ];
    fetchSpy.mockResolvedValue(jsonResponse({ items, total_count: 2 }));

    const result = await capability.getBySKUAcrossFulfillmentCenters({
      variant: { sku: 'SKU-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual([
        {
          identifier: { variant: { sku: 'SKU-1' }, fulfillmentCenter: { key: 'store_a' } },
          quantity: 5,
          status: 'inStock',
        },
        {
          identifier: { variant: { sku: 'SKU-1' }, fulfillmentCenter: { key: 'store_b' } },
          quantity: 0,
          status: 'outOfStock',
        },
      ]);
    }

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.pathname).toBe('/rest/default/V1/inventory/source-items');
    expect(url.searchParams.get('searchCriteria[filterGroups][0][filters][0][field]')).toBe('sku');
    expect(url.searchParams.get('searchCriteria[filterGroups][0][filters][0][value]')).toBe('SKU-1');
    expect(url.searchParams.get('searchCriteria[filterGroups][0][filters][0][condition_type]')).toBe('eq');
    expect(url.searchParams.get('searchCriteria[filterGroups][1][filters][0][field]')).toBeNull();
    expect(url.searchParams.get('searchCriteria[pageSize]')).toBe('300');
    expect(url.searchParams.get('searchCriteria[currentPage]')).toBe('1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('pages through source items until total_count is reached', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { sku: 'SKU-1', source_code: 'store_a', quantity: 1, status: 1 },
            { sku: 'SKU-1', source_code: 'store_b', quantity: 2, status: 1 },
          ],
          total_count: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ sku: 'SKU-1', source_code: 'store_c', quantity: 3, status: 1 }],
          total_count: 3,
        }),
      );

    const result = await capability.getBySKUAcrossFulfillmentCenters({
      variant: { sku: 'SKU-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.map((i) => i.identifier.fulfillmentCenter.key)).toEqual([
        'store_a',
        'store_b',
        'store_c',
      ]);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(String(fetchSpy.mock.calls[1][0]));
    expect(secondUrl.searchParams.get('searchCriteria[currentPage]')).toBe('2');
  });

  it('stops paging on an empty page even if total_count is not reached', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ sku: 'SKU-1', source_code: 'store_a', quantity: 1, status: 1 }],
          total_count: 5,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [], total_count: 5 }));

    const result = await capability.getBySKUAcrossFulfillmentCenters({
      variant: { sku: 'SKU-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array for an unknown SKU', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ items: [], total_count: 0 }));

    const result = await capability.getBySKUAcrossFulfillmentCenters({
      variant: { sku: 'UNKNOWN' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual([]);
    }
  });

  it('surfaces a Magento failure as an error result', async () => {
    fetchSpy.mockResolvedValue(new Response('Internal error', { status: 500 }));

    const result = await capability.getBySKUAcrossFulfillmentCenters({
      variant: { sku: 'SKU-1' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('uses the admin bearer token even when a customer is logged in', async () => {
    await new RequestContextTokenStore(reqCtx).setItem('customerToken', 'customer-token');
    fetchSpy.mockResolvedValue(jsonResponse({ items: [], total_count: 0 }));

    await capability.getBySKUAcrossFulfillmentCenters({ variant: { sku: 'SKU-1' } });

    const init = fetchSpy.mock.calls[0][1];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer admin-token' });
  });
});
