import { describe, expect, it } from 'vitest';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
  unwrapValue,
} from '@reactionary/core';
import { FakeStoreCapability } from '../capabilities/store.capability.js';
import { FakeStoreFactory } from '../factories/store/store.factory.js';
import { getFakerTestConfiguration } from './test-utils.js';

describe('FakeStoreCapability', () => {
  const capability = new FakeStoreCapability(
    getFakerTestConfiguration(),
    new NoOpCache(),
    createInitialRequestContext(),
    new FakeStoreFactory(StoreSchema),
  );

  it('seeds 3 physical stores per country', async () => {
    const page = unwrapValue(
      await capability.list({ paginationOptions: { pageNumber: 1, pageSize: 50 } }),
    );

    expect(page.totalCount).toBe(15);

    const byCountry = new Map<string, number>();
    for (const store of page.items) {
      const country = store.address?.countryCode || '';
      byCountry.set(country, (byCountry.get(country) || 0) + 1);
    }

    expect(Object.fromEntries(byCountry)).toEqual({ DK: 3, SE: 3, NO: 3, FI: 3, US: 3 });
  });

  it('pages the seeded stores', async () => {
    const page = unwrapValue(
      await capability.list({ paginationOptions: { pageNumber: 2, pageSize: 5 } }),
    );

    expect(page.totalCount).toBe(15);
    expect(page.totalPages).toBe(3);
    expect(page.items).toHaveLength(5);
  });

  it('gets a seeded store by its identifier, deterministically', async () => {
    const store = unwrapValue(await capability.getById({ identifier: { key: 'dk-1' } }));
    const again = unwrapValue(await capability.getById({ identifier: { key: 'dk-1' } }));

    expect(store.identifier.key).toBe('dk-1');
    expect(store.address?.countryCode).toBe('DK');
    expect(store).toEqual(again);
  });

  it('returns NotFound for an unknown store key', async () => {
    const result = await capability.getById({ identifier: { key: 'xx-99' } });

    expect(result.success).toBe(false);
  });

  it('limits proximity queries to the requested count', async () => {
    const stores = unwrapValue(
      await capability.queryByProximity({
        latitude: 55.6761,
        longitude: 12.5683,
        distance: 100,
        limit: 4,
      }),
    );

    expect(stores).toHaveLength(4);
  });
});
