// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclStoreCapability } from '../capabilities/store.capability.js';
import { HclStoreFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

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
