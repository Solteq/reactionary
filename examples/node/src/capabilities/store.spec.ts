import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient } from '../utils.js';

describe('Store Capability', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
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
