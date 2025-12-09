import 'dotenv/config';
import { assert, describe, expect, it } from 'vitest';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import {
  createInitialRequestContext,
  MemoryCache,
  type ProductIdentifier,
} from '@reactionary/core';
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import { CommercetoolsClient } from '../core/client.js';

describe('Caching', () => {
  it('should cache repeat look-ups', async () => {
    const config = getCommercetoolsTestConfiguration();
    const context = createInitialRequestContext();
    const cache = new MemoryCache();
    const client = new CommercetoolsClient(config, context);
    const provider = new CommercetoolsProductProvider(config, cache, context, client);

    const identifier = {
        key: 'product_10959528'
    } satisfies ProductIdentifier;

    const uncached = await provider.getById({
        identifier
    });

    if (!uncached.success) {
      assert.fail();
    }

    expect(uncached.meta.cache.hit).toBe(false);

    const cached = await provider.getById({
        identifier
    });

    if (!cached.success) {
      console.log('cached: ', cached);
      assert.fail();
    }

    expect(cached.meta.cache.hit).toBe(true);
  });
});
