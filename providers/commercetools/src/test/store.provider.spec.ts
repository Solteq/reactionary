import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsStoreProvider } from '../providers/store.provider.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

describe('Commercetools Store Provider', () => {
  let provider: CommercetoolsStoreProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config);
    const userClient = client.getClient(reqCtx);

    provider = new CommercetoolsStoreProvider(
      config,
      StoreSchema,
      new NoOpCache(),
      reqCtx,
      userClient
    );
  });

  it.skip('should be able to query stores by longitude and latitude', async () => {
    const stores = await provider.queryByProximity({
      distance: 1000,
      latitude: 15,
      longitude: 15,
      limit: 10,
    });

    expect(stores.length).toBe(2);
  });
});
