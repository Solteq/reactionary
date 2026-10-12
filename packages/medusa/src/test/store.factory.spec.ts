import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AdminStockLocation } from '@medusajs/types';
import { StoreSchema, createInitialRequestContext } from '@reactionary/core';
import { MedusaStoreFactory } from '../factories/store/store.factory.js';

/**
 * Offline tests for mapping a Medusa stock location to a core store,
 * for in-store pickup (BOPIS).
 */
const FIXTURES = new URL('./__fixtures__/store/', import.meta.url);

function readStockLocation(name: string): AdminStockLocation {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

describe('Medusa store factory', () => {
  const factory = new MedusaStoreFactory(StoreSchema);
  const context = createInitialRequestContext();

  it('maps a pickup stock location to a store', () => {
    const store = factory.parseStore(context, readStockLocation('stock-location-pickup.json'));

    expect(store.identifier).toEqual({ key: 'sloc_copenhagen' });
    expect(store.name).toBe('Copenhagen Flagship');
    // fulfillment centers are referenced by stock-location name elsewhere in
    // the provider (see the inventory capability)
    expect(store.fulfillmentCenter).toEqual({ key: 'Copenhagen Flagship' });
    expect(store.openingHours).toBe('Mon-Fri 10am-7pm, Sat 10am-4pm');
    expect(store.address).toMatchObject({
      streetAddress: 'Strøget 1',
      streetNumber: '2nd floor',
      city: 'Copenhagen',
      region: 'Capital Region',
      postalCode: '1160',
      countryCode: 'dk',
    });
  });

  it('maps a stock location without opening hours metadata', () => {
    const store = factory.parseStore(
      context,
      readStockLocation('stock-location-warehouse.json'),
    );

    expect(store.openingHours).toBeUndefined();
    expect(store.address).toMatchObject({
      streetAddress: 'Industrivej 12',
      city: 'Taastrup',
    });
  });

  it('leaves the address absent when the stock location has none', () => {
    const location = readStockLocation('stock-location-pickup.json');
    delete location.address;

    const store = factory.parseStore(context, location);

    expect(store.address).toBeUndefined();
  });
});
