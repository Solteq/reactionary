import type { RequestContext } from '@reactionary/core';
import { NoOpCache, StoreSchema, createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoStoreCapability } from '../capabilities/store.capability.js';
import { MagentoClient } from '../core/client.js';
import { withMagentoCapabilities } from '../core/initialize.js';
import { MagentoStoreFactory, type MagentoSource } from '../factories/store/store.factory.js';
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

// Helsinki city centre — the query origin in every test.
const ORIGIN = { latitude: 60.1699, longitude: 24.9384 };

const HELSINKI: MagentoSource = {
  source_code: 'helsinki',
  name: 'Helsinki',
  enabled: true,
  latitude: 60.1699,
  longitude: 24.9384,
};
const ESPOO: MagentoSource = {
  source_code: 'espoo',
  name: 'Espoo',
  enabled: true,
  latitude: 60.2055,
  longitude: 24.6559,
}; // ~16 km
const TURKU: MagentoSource = {
  source_code: 'turku',
  name: 'Turku',
  enabled: true,
  latitude: 60.4518,
  longitude: 22.2666,
}; // ~150 km
const NO_COORDINATES: MagentoSource = {
  source_code: 'default',
  name: 'Default Source',
  enabled: true,
  latitude: null,
  longitude: null,
};
const DISABLED: MagentoSource = {
  source_code: 'closed',
  name: 'Closed',
  enabled: false,
  latitude: 60.1699,
  longitude: 24.9384,
};

describe('MagentoStoreCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: { searchInventorySources: ReturnType<typeof vi.fn> };
  let capability: MagentoStoreCapability;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = { searchInventorySources: vi.fn() };
    capability = new MagentoStoreCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoStoreFactory(StoreSchema),
    );
  });

  const keys = async (distance: number, limit: number) => {
    const result = await capability.queryByProximity({ ...ORIGIN, distance, limit });
    expect(result.success).toBe(true);
    return result.success ? result.value.map((s) => s.identifier.key) : [];
  };

  it('sorts the stores nearest first', async () => {
    magentoApi.searchInventorySources.mockResolvedValue({
      items: [TURKU, HELSINKI, ESPOO],
      total_count: 3,
    });

    expect(await keys(500, 10)).toEqual(['helsinki', 'espoo', 'turku']);
  });

  it('excludes stores outside the radius (kilometres)', async () => {
    magentoApi.searchInventorySources.mockResolvedValue({
      items: [TURKU, HELSINKI, ESPOO],
      total_count: 3,
    });

    expect(await keys(50, 10)).toEqual(['helsinki', 'espoo']);
  });

  it('returns at most `limit` stores', async () => {
    magentoApi.searchInventorySources.mockResolvedValue({
      items: [TURKU, HELSINKI, ESPOO],
      total_count: 3,
    });

    expect(await keys(500, 2)).toEqual(['helsinki', 'espoo']);
  });

  it('excludes sources without coordinates', async () => {
    magentoApi.searchInventorySources.mockResolvedValue({
      items: [NO_COORDINATES, HELSINKI],
      total_count: 2,
    });

    expect(await keys(20000, 10)).toEqual(['helsinki']);
  });

  it('excludes disabled sources', async () => {
    magentoApi.searchInventorySources.mockResolvedValue({
      items: [DISABLED, ESPOO],
      total_count: 2,
    });

    expect(await keys(500, 10)).toEqual(['espoo']);
  });

  it('pages through every inventory source', async () => {
    magentoApi.searchInventorySources
      .mockResolvedValueOnce({ items: [TURKU], total_count: 2 })
      .mockResolvedValueOnce({ items: [HELSINKI], total_count: 2 });

    expect(await keys(500, 10)).toEqual(['helsinki', 'turku']);

    expect(magentoApi.searchInventorySources).toHaveBeenCalledTimes(2);
    const pages = magentoApi.searchInventorySources.mock.calls.map((call) =>
      (call[0] as URLSearchParams).get('searchCriteria[currentPage]'),
    );
    expect(pages).toEqual(['1', '2']);
  });
});

describe('MagentoClient.searchInventorySources', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads MSI sources over the admin REST channel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [HELSINKI], total_count: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new MagentoClient(config, createInitialRequestContext());
    const params = new URLSearchParams({ 'searchCriteria[pageSize]': '500' });

    const result = await client.searchInventorySources(params);

    expect(result.items).toEqual([HELSINKI]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://example.com/rest/default/V1/inventory/sources?searchCriteria%5BpageSize%5D=500',
    );
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' });
  });
});

describe('withMagentoCapabilities store', () => {
  it('wires the store capability when enabled', () => {
    const client = withMagentoCapabilities(config, { store: { enabled: true } })(
      new NoOpCache(),
      createInitialRequestContext(),
    );

    expect(client.store).toBeInstanceOf(MagentoStoreCapability);
  });
});
