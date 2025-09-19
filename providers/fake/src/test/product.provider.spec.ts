import 'dotenv/config';

import type { Session } from '@reactionary/core';
import { MemoryCache, ProductSchema } from '@reactionary/core';
import { createAnonymousTestSession, getFakerTestConfiguration } from './test-utils';
import { FakeProductProvider } from '../providers';

describe('Fake Product Provider', () => {
  let provider: FakeProductProvider;
  let session: Session;

  beforeAll(async () => {
    provider = new FakeProductProvider(getFakerTestConfiguration(), ProductSchema, new MemoryCache());
  });

  beforeEach( () => {
    session = createAnonymousTestSession()
  })

  it('should cache repeat product lookups by id', async () => {
    const first = await provider.getById({ id: '1234' }, session);
    expect(first.meta.cache.hit).toBe(false);

    const second = await provider.getById({ id: '1234' }, session);
    expect(second.meta.cache.hit).toBe(true);
  });
});
