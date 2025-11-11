import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

describe.each([PrimaryProvider.COMMERCETOOLS])('Store Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it.skip('should be able to query stores by longitude and latitude', async () => {
    const stores = await client.store.queryByProximity({
      distance: 1000,
      latitude: 15,
      longitude: 15,
      limit: 10,
    });

    expect(stores.length).toBe(2);
  });
});
