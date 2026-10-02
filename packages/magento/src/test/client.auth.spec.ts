import type { RequestContext } from '@reactionary/core';
import { createInitialRequestContext } from '@reactionary/core';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoClient, RequestContextTokenStore } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'admin-key',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

const ADMIN = 'Bearer admin-key';
const CUSTOMER = 'Bearer customer-token';

/**
 * Magento's catalog and inventory REST GETs are admin-ACL resources (they are
 * absent from the customer and guest OpenAPI specs in `docs/`), so a shopper's
 * customer token must never be sent to them — Magento answers 401 and the
 * capabilities swallow it as empty/out-of-stock results.
 */
describe('MagentoClient REST authorization for a logged-in shopper', () => {
  let context: RequestContext;
  let client: MagentoClient;
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(async () => {
    context = createInitialRequestContext();
    await new RequestContextTokenStore(context).setItem(
      'customerToken',
      'customer-token',
    );
    client = new MagentoClient(config, context);
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function lastAuthorization(): string | null {
    const init = fetchSpy.mock.calls.at(-1)?.[1];
    return new Headers(init?.headers).get('Authorization');
  }

  const params = () => new URLSearchParams('searchCriteria[pageSize]=1');

  it.each([
    ['GET /V1/products/{sku}', (m: MagentoClient) => m.getProductBySKU('SKU-1')],
    ['GET /V1/products', (m: MagentoClient) => m.searchProducts(params())],
    ['GET /V1/products/{sku}/links/{type}', (m: MagentoClient) => m.getProductLinks('SKU-1', 'related')],
    ['GET /V1/categories/{id}', async (m: MagentoClient) => (await m.getClient()).store.category.getById('3')],
    ['GET /V1/categories/list', async (m: MagentoClient) => (await m.getClient()).store.category.list(params())],
    ['GET /V1/categories/list (by external_id)', async (m: MagentoClient) => (await m.getClient()).store.category.getByExternalId('ext')],
    ['GET /V1/stockStatuses/{sku}', async (m: MagentoClient) => (await m.getClient()).store.inventory.getStockStatus('SKU-1')],
    ['GET /V1/inventory/source-items', async (m: MagentoClient) => (await m.getClient()).store.inventory.getSourceItems(params())],
  ])('sends the admin key, not the customer token, to %s', async (_name, call) => {
    await call(client);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastAuthorization()).toBe(ADMIN);
  });

  it('keeps sending the customer token to carts/mine', async () => {
    await client.getCart();
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toBe(
      'https://example.com/rest/default/V1/carts/mine',
    );
    expect(lastAuthorization()).toBe(CUSTOMER);
  });

  it('keeps sending the customer token to customers/me', async () => {
    await client.getMe();
    expect(lastAuthorization()).toBe(CUSTOMER);
  });
});
