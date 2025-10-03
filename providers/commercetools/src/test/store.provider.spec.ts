import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  StoreSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils';
import { CommercetoolsStoreProvider } from '../providers/store.provider';

describe('Commercetools Store Provider', () => {
  let provider: CommercetoolsStoreProvider;
  let reqCtx: RequestContext;

  beforeAll(() => {
    provider = new CommercetoolsStoreProvider(
      getCommercetoolsTestConfiguration(),
      StoreSchema,
      new NoOpCache()
    );
  });

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
  });

  it('should be able to query stores by longitude and latitude', async () => {
    const stores = await provider.queryByProximity({
        distance: 1000,
        latitude: 15,
        longitude: 15,
        limit: 10
    }, reqCtx);

    expect(stores.length).toBe(2);
  });
});
