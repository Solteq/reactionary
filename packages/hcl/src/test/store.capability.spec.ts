// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert, vi } from 'vitest';
import { HclStoreCapability } from '../capabilities/store.capability.js';
import { HclStoreFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type { HclPhysicalStore, HclStoreLocatorResponse } from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';

// Solteq demo server approximate coordinates (Helsinki, Finland)
const testData = {
  latitude: 60.1699,
  longitude: 24.9384,
  radius: 100,
};

describe('HCL Store Capability', () => {
  let provider: HclStoreCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclStoreCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclStoreFactory(StoreSchema),
    );
  });

  it('should return nearby stores as an array', async () => {
    const result = await provider.queryByProximity({
      latitude: testData.latitude,
      longitude: testData.longitude,
      distance: testData.radius,
      limit: 10,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value)).toBe(true);
  });

  it('should return stores with valid shape when results exist', async () => {
    const result = await provider.queryByProximity({
      latitude: testData.latitude,
      longitude: testData.longitude,
      distance: testData.radius,
      limit: 5,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);

    for (const store of result.value) {
      expect(store.identifier).toBeDefined();
      expect(typeof store.identifier.key).toBe('string');
      expect(typeof store.name).toBe('string');
    }
  });
});

// Offline (mocked) tests: list is synthesized as a global proximity search
// from (0, 0), so no live HCL server is needed to verify the mapping.
describe('HCL Store Capability — list as global proximity search (offline)', () => {
  function buildProvider() {
    const reqCtx = createInitialRequestContext();
    // A static configuration: these tests never leave the mocked client.
    const config = HclConfigurationSchema.parse({
      apiUrl: 'https://hcl.example.com/wcs/resources',
      searchApiUrl: 'https://hcl.example.com/search/resources',
      storeId: '41',
    });
    const client = new HclClient(config, reqCtx);
    const provider = new HclStoreCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclStoreFactory(StoreSchema),
    );
    return { provider, client };
  }

  function physicalStore(uniqueID: string): HclPhysicalStore {
    return {
      uniqueID,
      storeName: `Store ${uniqueID}`,
    };
  }

  it('queries the geo endpoint from (0, 0) with a globe-covering radius and record-set paging', async () => {
    const { provider, client } = buildProvider();
    const callGet = vi.spyOn(client, 'callGet').mockResolvedValue({
      PhysicalStore: [physicalStore('s-1'), physicalStore('s-2')],
      recordSetTotal: '7',
    } satisfies HclStoreLocatorResponse);

    const result = await provider.list({
      paginationOptions: { pageNumber: 1, pageSize: 2 },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value).toMatchObject({
      pageNumber: 1,
      pageSize: 2,
      totalCount: 7,
      totalPages: 4,
    });
    expect(result.value.items.map((store) => store.identifier.key)).toEqual(['s-1', 's-2']);

    const [url, params] = callGet.mock.calls[0];
    expect(url).toContain('/storelocator/latitude/0/longitude/0');
    expect(params?.get('radius')).toBe('25000');
    expect(params?.get('radiusUOM')).toBe('km');
    expect(params?.get('pageNumber')).toBe('1');
    expect(params?.get('pageSize')).toBe('2');
  });

  it('pages client-side when the endpoint ignores the record-set parameters', async () => {
    const { provider, client } = buildProvider();
    vi.spyOn(client, 'callGet').mockResolvedValue({
      PhysicalStore: Array.from({ length: 12 }, (_, i) => physicalStore(`s-${i}`)),
    } satisfies HclStoreLocatorResponse);

    const result = await provider.list({
      paginationOptions: { pageNumber: 2, pageSize: 5 },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.totalCount).toBe(12);
    expect(result.value.totalPages).toBe(3);
    expect(result.value.items.map((store) => store.identifier.key)).toEqual([
      's-5',
      's-6',
      's-7',
      's-8',
      's-9',
    ]);
  });

  it('returns an empty page when the locator reports no stores', async () => {
    const { provider, client } = buildProvider();
    vi.spyOn(client, 'callGet').mockResolvedValue(undefined);

    const result = await provider.list({
      paginationOptions: { pageNumber: 1, pageSize: 20 },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.totalCount).toBe(0);
    expect(result.value.items).toEqual([]);
  });
});
