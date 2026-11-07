import {
  NoOpCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MedusaProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { MedusaAPI } from '../core/client.js';
import { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { getMedusaTestConfiguration } from './test-utils.js';

function query(search: Partial<ProductSearchQueryByTerm['search']> = {}): ProductSearchQueryByTerm {
  return {
    search: { term: 'printer', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 }, ...search },
  };
}

describe('Medusa product search typed filters', () => {
  const getClient = vi.fn();
  const capability = new MedusaProductSearchCapability(
    getMedusaTestConfiguration(),
    new NoOpCache(),
    createInitialRequestContext(),
    { getClient } as unknown as MedusaAPI,
    new MedusaProductSearchFactory(ProductSearchResultSchema),
  );

  it.each([
    ['priceFilter', { priceFilter: { max: 100 } }],
    ['ratingFilter', { ratingFilter: { min: 4 } }],
    ['conceptFilter', { conceptFilter: [{ key: 'features/cordless' }] }],
    ['conceptContext', { conceptContext: [{ key: 'features/cordless' }] }],
    ['availabilityFilter', { availabilityFilter: { stores: [{ key: 'store_1' }] } }],
  ])('refuses %s instead of dropping it', async (name, filter) => {
    const result = await capability.queryByTerm(query(filter));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
      expect(JSON.stringify(result.error)).toContain(name);
    }
    expect(getClient).not.toHaveBeenCalled();
  });

  it('does not refuse empty filters', async () => {
    getClient.mockResolvedValue({ store: { product: { list: vi.fn().mockResolvedValue({ products: [], count: 0, offset: 0, limit: 20 }) } } });
    const result = await capability.queryByTerm(query({ priceFilter: {}, conceptFilter: [] }));
    expect(result.success).toBe(true);
  });
});
