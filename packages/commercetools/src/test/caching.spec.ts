import { assert, describe, expect, it } from 'vitest';
import { useCommercetoolsFixtures } from './fixture-fetch.js';
import {
  createInitialRequestContext,
  MemoryCache,
  ProductSchema,
  ProductSearchResultSchema,
  type ProductIdentifier,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { CommercetoolsProductCapability } from '../capabilities/product.capability.js';
import { CommercetoolsAPI } from '../core/client.js';
import { CommercetoolsProductSearchCapability } from '../capabilities/product-search.capability.js';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';

describe('Caching', () => {
  const fixtureConfig = useCommercetoolsFixtures('caching');

  it('should cache repeat look-ups for products', async () => {
    const config = fixtureConfig;
    const context = createInitialRequestContext();
    const cache = new MemoryCache();
    const client = new CommercetoolsAPI(config, context);
    const capability = new CommercetoolsProductCapability(
      cache,
      context,
      config,
      client,
      new CommercetoolsProductFactory(ProductSchema)
    );

    const identifier = {
        key: 'product_91375834'
    } satisfies ProductIdentifier;

    const uncached = await capability.getById({
        identifier
    });

    if (!uncached.success) {
      assert.fail();
    }

    expect(uncached.meta.cache.hit).toBe(false);

    const cached = await capability.getById({
        identifier
    });

    if (!cached.success) {
      assert.fail();
    }

    expect(cached.meta.cache.hit).toBe(true);
  });

  it('should cache repeat look-ups for product search', async () => {
    const config = fixtureConfig;
    const context = createInitialRequestContext();
    const cache = new MemoryCache();
    const client = new CommercetoolsAPI(config, context);
    const capability = new CommercetoolsProductSearchCapability(
      config,
      cache,
      context,
      client,
      new CommercetoolsProductSearchFactory(ProductSearchResultSchema),
    );

    const query = {
      search: {
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 10
        },
        term: 'laptop'
      }
    } satisfies ProductSearchQueryByTerm;

    const uncached = await capability.queryByTerm(query);

    if (!uncached.success) {
      assert.fail();
    }

    expect(uncached.meta.cache.hit).toBe(false);

    const cached = await capability.queryByTerm(query);

    if (!cached.success) {
      assert.fail();
    }

    expect(cached.meta.cache.hit).toBe(true);
  });
});
