import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createHclClient } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
const testData = {
  searchTerm: 'chair',
  // Category external identifier for category-browse search
  categoryKey: 'LivingRoomFurniture',
};

describe('HCL Product Search Capability', () => {
  let client: ReturnType<typeof createHclClient>;

  beforeEach(() => {
    client = createHclClient();
  });

  it('should be able to get a result by term', async () => {
    const result = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
  });

  it('should be able to get a result by term, paged', async () => {
    const result = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 1 },
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.totalPages).toBeGreaterThan(1);

    const result2 = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 2, pageSize: 1 },
      },
    });

    if (!result2.success) {
      assert.fail(JSON.stringify(result2.error));
    }

    expect(result2.value.items.length).toBeGreaterThan(0);
    expect(result2.value.items[0].identifier.key).not.toBe(
      result.value.items[0].identifier.key,
    );
  });

  it('should be able to change page size', async () => {
    const smallPage = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 2 },
      },
    });
    const largePage = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 12 },
      },
    });

    if (!smallPage.success || !largePage.success) {
      assert.fail();
    }

    expect(smallPage.value.items.length).toBe(2);
    expect(smallPage.value.pageSize).toBe(2);
    expect(largePage.value.items.length).toBeGreaterThan(2);
    expect(largePage.value.pageSize).toBe(12);
  });

  it('should be able to apply facets', async () => {
    const initial = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!initial.success) {
      assert.fail(JSON.stringify(initial.error));
    }

    const brandFacet = initial.value.facets.find(
      (f) => f.identifier.key === 'manufacturer.raw',
    );
    if (!brandFacet || brandFacet.values.length === 0) {
      assert.fail('Expected manufacturer.raw facet in results');
    }

    const firstValue = brandFacet.values.at(0);
    if (!firstValue) assert.fail('Expected at least one brand facet value');

    const filtered = await client.productSearch.queryByTerm({
      search: {
        term: testData.searchTerm,
        facets: [firstValue.identifier],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!filtered.success) {
      assert.fail(JSON.stringify(filtered.error));
    }

    expect(filtered.value.totalCount).toBeLessThan(initial.value.totalCount);
    expect(filtered.value.totalCount).toBeGreaterThan(0);
  });

  it('should filter by category when categoryFilter is provided', async () => {
    const result = await client.productSearch.queryByTerm({
      search: {
        term: '',
        facets: [],
        filters: [],
        categoryFilter: {
          facet: { key: 'categories' },
          key: testData.categoryKey,
        },
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
  });

  it('should return empty results for an impossible search term', async () => {
    const result = await client.productSearch.queryByTerm({
      search: {
        term: 'XQZWKFGHPQR_IMPOSSIBLE_TERM_99999',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBe(0);
  });
});
