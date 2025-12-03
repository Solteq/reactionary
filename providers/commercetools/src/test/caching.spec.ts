import 'dotenv/config';
import { describe, expect, it } from 'vitest';
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
        key: '0766623301831'
    } satisfies ProductIdentifier;

    const uncached = await provider.getById({
        identifier
    });
    expect(uncached.meta.cache.hit).toBe(false);

    const cached = await provider.getById({
        identifier
    });
    expect(cached.meta.cache.hit).toBe(true);
  });
});
