import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsStoreProvider } from '../providers/store.provider.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

describe('Commercetools Store Provider', () => {
  let provider: CommercetoolsStoreProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();

    provider = new CommercetoolsStoreProvider(
      getCommercetoolsTestConfiguration(),
      StoreSchema,
      new NoOpCache(),
      reqCtx
    );
  });

  it.skip('should be able to query stores by longitude and latitude', async () => {
    const stores = await provider.queryByProximity({
        distance: 1000,
        latitude: 15,
        longitude: 15,
        limit: 10
    });

    expect(stores.length).toBe(2);
  });
});
