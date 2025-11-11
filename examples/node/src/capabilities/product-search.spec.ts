import 'dotenv/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '../utils.js';

const testData = {
  searchTerm: 'cable'
}

describe('Product Search Capability', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
  });

  it('should be able to get a result by term', async () => {
    const result = await client.productSearch.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
      filters: []
    }});

    expect(result.items.length).toBeGreaterThan(0);
  });


  it('should be able to get a result by term, paged', async () => {
    const result = await client.productSearch.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 1,
      },
      filters: []
    }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(1);

    const result2 = await client.productSearch.queryByTerm( {
    search: {
      term: testData.searchTerm,
      facets: [],
      paginationOptions: {
        pageNumber: 2,
        pageSize: 1,
      },
      filters: []
    }});

    expect(result2.items.length).toBeGreaterThan(0);
    expect(result2.totalPages).toBeGreaterThan(2);
    expect(result2.items[0].identifier.key).not.toBe(result.items[0].identifier.key);
  });
});
