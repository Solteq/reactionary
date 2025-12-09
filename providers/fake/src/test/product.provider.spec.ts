import 'dotenv/config';

import type { RequestContext } from '@reactionary/core';
import { createInitialRequestContext, MemoryCache } from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeProductProvider } from '../providers/index.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

describe('Fake Product Provider', () => {
  let provider: FakeProductProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    provider = new FakeProductProvider(getFakerTestConfiguration(),  new MemoryCache(), reqCtx);
  })

  it('should cache repeat product lookups by id', async () => {
    const first = await provider.getById({ identifier: { key : '1234' }});

    if (!first.success) {
      assert.fail();
    }

    expect(first.meta.cache.hit).toBe(false);

    const second = await provider.getById({ identifier: { key : '1234' }});
    
    if (!second.success) {
      assert.fail();
    }

    expect(second.meta.cache.hit).toBe(true);
  });
});
