import 'dotenv/config';

import type { RequestContext } from '@reactionary/core';
import { createInitialRequestContext, MemoryCache, ProductSchema } from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeProductProvider } from '../providers/index.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

describe('Fake Product Provider', () => {
  let provider: FakeProductProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    provider = new FakeProductProvider(getFakerTestConfiguration(), ProductSchema, new MemoryCache(), reqCtx);
  })

  it('should cache repeat product lookups by id', async () => {
    const first = await provider.getById({ id: '1234' });
    expect(first.meta.cache.hit).toBe(false);

    const second = await provider.getById({ id: '1234' });
    expect(second.meta.cache.hit).toBe(true);
  });
});
