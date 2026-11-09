import {
  NoOpCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import { HclClient } from '../core/client.js';
import { HclProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';

function query(search: Partial<ProductSearchQueryByTerm['search']> = {}): ProductSearchQueryByTerm {
  return {
    search: { term: 'chair', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  };
}

describe('HCL product search typed filters (offline)', () => {
  const reqCtx = createInitialRequestContext();
  const config = HclConfigurationSchema.parse({
    apiUrl: 'https://hcl.example.com',
    searchApiUrl: 'https://hcl.example.com/search/resources',
    storeId: '41',
  });
  const client = new HclClient(config, reqCtx);
  const callGet = vi.spyOn(client, 'callGet').mockResolvedValue({ contents: [], facets: [] });
  const capability = new HclProductSearchCapability(
    new NoOpCache(),
    reqCtx,
    config,
    client,
    new HclProductSearchFactory(ProductSearchResultSchema),
  );

  it.each([
    ['priceFilter', { priceFilter: { max: 100 } }],
    ['ratingFilter', { ratingFilter: { min: 4 } }],
    ['conceptFilter', { conceptFilter: [{ key: 'features/cordless' }] }],
    ['conceptContext', { conceptContext: [{ key: 'features/cordless' }] }],
    ['availabilityFilter', { availabilityFilter: { online: true } }],
  ])('refuses %s instead of dropping it', async (name, filter) => {
    const result = await capability.queryByTerm(query(filter));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
      expect(JSON.stringify(result.error)).toContain(name);
    }
    expect(callGet).not.toHaveBeenCalled();
  });

  it('searches when no typed filter is set', async () => {
    const result = await capability.queryByTerm(query());
    expect(result.success).toBe(true);
    expect(callGet).toHaveBeenCalledTimes(1);
  });
});
