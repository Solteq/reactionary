import type { Cache, RequestContext } from '@reactionary/core';
import { MemoryCache, NoOpCache, StoreSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoStoreCapability, haversineDistanceKm } from '../capabilities/store.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoStoreFactory } from '../factories/store/store.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const COPENHAGEN = {
  pickup_location_code: 'cph',
  name: 'Copenhagen',
  contact_name: 'Store manager',
  latitude: 55.6761,
  longitude: 12.5683,
  street: 'Strøget 1',
  city: 'Copenhagen',
  postcode: '1100',
  region: 'Capital',
  country_id: 'DK',
};
const AARHUS = { pickup_location_code: 'aar', name: 'Aarhus', latitude: 56.1629, longitude: 10.2039, country_id: 'DK' };
const MALMO = { pickup_location_code: 'mmo', name: 'Malmö', latitude: 55.605, longitude: 13.0038, country_id: 'SE' };
const NO_COORDS = { pickup_location_code: 'nowhere', name: 'Nowhere' };

function page(items: unknown[], total = items.length) {
  return { pickupLocations: { items, total_count: total, page_info: { current_page: 1, page_size: 20, total_pages: 1 } } };
}

describe('MagentoStoreCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: { graphqlRequest: ReturnType<typeof vi.fn> };

  function create(cache: Cache = new NoOpCache()) {
    return new MagentoStoreCapability(
      config,
      cache,
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoStoreFactory(StoreSchema),
    );
  }

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = { graphqlRequest: vi.fn() };
  });

  it('lists pickup locations with server-side pagination', async () => {
    magentoApi.graphqlRequest.mockResolvedValue(page([COPENHAGEN, AARHUS], 5));

    const result = await create().list({ paginationOptions: { pageNumber: 2, pageSize: 2 } });

    expect(magentoApi.graphqlRequest).toHaveBeenCalledWith(expect.any(String), {
      pageSize: 2,
      currentPage: 2,
      filters: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.totalCount).toBe(5);
      expect(result.value.totalPages).toBe(3);
      expect(result.value.items[0]).toMatchObject({
        identifier: { key: 'cph' },
        fulfillmentCenter: { key: 'cph' },
        name: 'Copenhagen',
        address: { city: 'Copenhagen', postalCode: '1100', countryCode: 'DK', streetAddress: 'Strøget 1' },
      });
      expect(result.value.items[0].openingHours).toBeUndefined();
    }
  });

  it('gets a store by pickup location code', async () => {
    magentoApi.graphqlRequest.mockResolvedValue(page([COPENHAGEN]));

    const result = await create().getById({ identifier: { key: 'cph' } });

    expect(magentoApi.graphqlRequest).toHaveBeenCalledWith(expect.any(String), {
      pageSize: 1,
      currentPage: 1,
      filters: { pickup_location_code: { eq: 'cph' } },
    });
    expect(result.success && result.value.identifier.key).toBe('cph');
  });

  it('returns NotFound for an unknown pickup location', async () => {
    magentoApi.graphqlRequest.mockResolvedValue(page([]));

    const result = await create().getById({ identifier: { key: 'missing' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('filters by distance (km), sorts nearest first and applies the limit', async () => {
    magentoApi.graphqlRequest.mockResolvedValue(page([AARHUS, MALMO, NO_COORDS, COPENHAGEN]));

    const result = await create().queryByProximity({
      latitude: 55.6761,
      longitude: 12.5683,
      distance: 50,
      limit: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.map((s) => s.identifier.key)).toEqual(['cph', 'mmo']);
    }

    const limited = await create().queryByProximity({
      latitude: 55.6761,
      longitude: 12.5683,
      distance: 500,
      limit: 1,
    });
    expect(limited.success && limited.value.map((s) => s.identifier.key)).toEqual(['cph']);
  });

  it('pages through every location and caches them per store view', async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ pickup_location_code: `far-${i}`, latitude: 0, longitude: 0 }));
    magentoApi.graphqlRequest
      .mockResolvedValueOnce(page(first, 101))
      .mockResolvedValueOnce(page([COPENHAGEN], 101));

    const cache = new MemoryCache();
    const query = { latitude: 55.6761, longitude: 12.5683, distance: 10, limit: 5 };

    const result = await create(cache).queryByProximity(query);
    expect(magentoApi.graphqlRequest).toHaveBeenCalledTimes(2);
    expect(result.success && result.value.map((s) => s.identifier.key)).toEqual(['cph']);

    const again = await create(cache).queryByProximity(query);
    expect(magentoApi.graphqlRequest).toHaveBeenCalledTimes(2);
    expect(again.success && again.value.map((s) => s.identifier.key)).toEqual(['cph']);
  });

  it('returns a typed error when Magento fails', async () => {
    magentoApi.graphqlRequest.mockRejectedValue(new Error('boom'));

    const result = await create().list({ paginationOptions: { pageNumber: 1, pageSize: 20 } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('computes haversine distances in kilometers', () => {
    expect(haversineDistanceKm(55.6761, 12.5683, 56.1629, 10.2039)).toBeGreaterThan(150);
    expect(haversineDistanceKm(55.6761, 12.5683, 56.1629, 10.2039)).toBeLessThan(160);
  });
});
