import type { RequestContext, Store } from '@reactionary/core';
import { StoreSchema, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { MagentoStoreFactory, type MagentoSource } from '../factories/store/store.factory.js';

const RAW_SOURCE: MagentoSource = {
  source_code: 'helsinki',
  name: 'Helsinki Keskusta',
  enabled: true,
  latitude: 60.1699,
  longitude: 24.9384,
  city: 'Helsinki',
  street: 'Mannerheimintie 5',
  postcode: '00100',
  country_id: 'FI',
  phone: '+358 10 123 4567',
};

describe('MagentoStoreFactory', () => {
  it('maps an MSI source onto the core Store model', () => {
    const factory = new MagentoStoreFactory(StoreSchema);

    const store = factory.parseStore(createInitialRequestContext(), RAW_SOURCE);

    expect(store).toEqual({
      identifier: { key: 'helsinki' },
      name: 'Helsinki Keskusta',
      fulfillmentCenter: { key: 'helsinki' },
    });
  });

  it('lets a subclass extend the store from the raw source', () => {
    const ExtendedStoreSchema = StoreSchema.safeExtend({ city: z.string() });

    class ExtendedStoreFactory extends MagentoStoreFactory<typeof ExtendedStoreSchema> {
      public override parseStore(_context: RequestContext, data: MagentoSource) {
        return this.storeSchema.parse({ ...this.parseSource(data), city: data.city ?? '' });
      }
    }

    const store = new ExtendedStoreFactory(ExtendedStoreSchema).parseStore(
      createInitialRequestContext(),
      RAW_SOURCE,
    );

    expect(store.city).toBe('Helsinki');
    expect(store.identifier.key).toBe('helsinki');
    const base: Store = store;
    expect(base.name).toBe('Helsinki Keskusta');
  });
});
