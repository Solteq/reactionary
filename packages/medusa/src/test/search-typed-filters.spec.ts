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

  it('refuses conceptContext together with conceptFilter, which Medusa cannot combine, and more than one concept', async () => {
    getClient.mockClear();
    const both = await capability.queryByTerm(query({ conceptContext: [{ key: 'features/a' }], conceptFilter: [{ key: 'features/b' }] }));
    expect(both.success).toBe(false);
    const two = await capability.queryByTerm(query({ conceptContext: [{ key: 'features/a' }, { key: 'features/b' }] }));
    expect(two.success).toBe(false);
    if (!two.success) {
      expect(JSON.stringify(two.error)).toContain('one conceptContext concept');
    }
    expect(getClient).not.toHaveBeenCalled();
  });

  it('does not refuse empty filters', async () => {
    getClient.mockResolvedValue({ store: { product: { list: vi.fn().mockResolvedValue({ products: [], count: 0, offset: 0, limit: 20 }) } } });
    const result = await capability.queryByTerm(query({ priceFilter: {}, conceptFilter: [] }));
    expect(result.success).toBe(true);
  });

  describe('conceptContext', () => {
    const tag = (id: string, externalId: string, parent?: string, vocabulary?: string) => ({
      id,
      value: externalId.split('/')[1],
      external_id: externalId,
      metadata: { ...(parent ? { parent } : {}), ...(vocabulary ? { vocabulary } : {}) },
    });
    // lighting > lamps > ceiling-lamps, lighting > bulbs, and a tag of another vocabulary and a plain tag that are not concepts of it
    const tags = [
      tag('ptag_1', 'application/lighting'),
      tag('ptag_2', 'application/lamps', 'application/lighting'),
      tag('ptag_3', 'application/ceiling-lamps', 'application/lamps'),
      tag('ptag_4', 'application/bulbs', 'application/lighting'),
      tag('ptag_5', 'features/cordless'),
      { id: 'ptag_6', value: 'sale', external_id: null, metadata: null },
    ];

    function setup(tagList: unknown[] = tags) {
      const fetch = vi.fn().mockResolvedValue({ product_tags: tagList, count: tagList.length });
      const list = vi.fn().mockResolvedValue({ products: [], count: 0, offset: 0, limit: 20 });
      getClient.mockResolvedValue({ client: { fetch }, store: { product: { list } } });
      return { fetch, list };
    }

    it('lists the products of the tags of the concept and of everything below it', async () => {
      const { list } = setup();
      const result = await capability.queryByTerm(query({ conceptContext: [{ key: 'application/lamps' }] }));
      expect(result.success).toBe(true);
      expect(list).toHaveBeenCalledOnce();
      expect(list.mock.calls[0][0].tag_id.sort()).toEqual(['ptag_2', 'ptag_3']);
    });

    it('takes the whole vocabulary for its top concept, and not the tags of other vocabularies', async () => {
      const { list } = setup();
      await capability.queryByTerm(query({ conceptContext: [{ key: 'application/lighting' }] }));
      expect(list.mock.calls[0][0].tag_id.sort()).toEqual(['ptag_1', 'ptag_2', 'ptag_3', 'ptag_4']);
    });

    it('asks for the tags of the store, with their metadata, through the store api', async () => {
      const { fetch } = setup();
      await capability.queryByTerm(query({ conceptContext: [{ key: 'application/lamps' }] }));
      expect(fetch).toHaveBeenCalledWith('/store/product-tags', expect.objectContaining({ method: 'GET', query: expect.objectContaining({ fields: 'id,value,external_id,metadata', limit: 100, offset: 0 }) }));
    });

    it('matches nothing for a concept the store does not have, rather than every product', async () => {
      const { list } = setup();
      const result = await capability.queryByTerm(query({ conceptContext: [{ key: 'application/unknown' }] }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.items).toEqual([]);
        expect(result.value.totalCount).toBe(0);
      }
      expect(list).not.toHaveBeenCalled();
    });

    it('keeps the category filter next to the concept, and sends neither without them', async () => {
      const { list } = setup();
      await capability.queryByTerm(query());
      expect(list.mock.calls[0][0]).not.toHaveProperty('tag_id');
      expect(list.mock.calls[0][0]).not.toHaveProperty('category_id');
    });
  });
});
