import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import { HclProductSearchFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

describe('HCL Product Search Provider', () => {
  let provider: HclProductSearchCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config);
    provider = new HclProductSearchCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProductSearchFactory(ProductSearchResultSchema),
    );
  });

  it('should return products matching a search term', async () => {
    const result = await provider.queryByTerm({
      search: {
        term: 'cable',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].name).toBeTruthy();
    expect(result.value.items[0].slug).toBeTruthy();
    expect(result.value.totalCount).toBeGreaterThan(0);
  });

  it('should respect pagination', async () => {
    const page1 = await provider.queryByTerm({
      search: {
        term: 'cable',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 2 },
      },
    });

    const page2 = await provider.queryByTerm({
      search: {
        term: 'cable',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 2, pageSize: 2 },
      },
    });

    if (!page1.success || !page2.success) {
      assert.fail('Expected both pages to succeed');
    }

    expect(page1.value.items.length).toBeLessThanOrEqual(2);
    // Page 2 items should differ from page 1 items
    if (page2.value.items.length > 0) {
      expect(page1.value.items[0].identifier.key).not.toBe(
        page2.value.items[0].identifier.key,
      );
    }
  });

  it('should return facets in search results', async () => {
    const result = await provider.queryByTerm({
      search: {
        term: 'cable',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.facets).toBeDefined();
  });

  it('should filter by category when categoryFilter is provided', async () => {
    // LivingRoomFurniture (uniqueID=10502) is a known leaf category with products
    const result = await provider.queryByTerm({
      search: {
        term: '',
        facets: [],
        filters: [],
        categoryFilter: { facet: { key: 'categories' }, key: '10502' },
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.items.length).toBeGreaterThan(0);
  });

  it('should return empty results for an impossible search term', async () => {
    const result = await provider.queryByTerm({
      search: {
        term: 'xyzzy-no-product-matches-this-impossible-term-9999',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    // HCL uses fuzzy/similarity search so truly 0 results is not guaranteed.
    // Instead verify the count is much lower than a normal search would return.
    expect(result.value.totalCount).toBeLessThan(3);
  });

  it('should create a category navigation filter', async () => {
    const result = await provider.createCategoryNavigationFilter({
      categoryPath: [
        {
          identifier: { key: '10000' },
          name: 'Electronics',
          slug: 'electronics',
          text: '',
          images: [],
        },
        {
          identifier: { key: '10001' },
          name: 'Cables',
          slug: 'cables',
          text: '',
          images: [],
        },
      ],
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    // The leaf category should be used as the navigation filter
    expect(result.value.facet.key).toBe('categories');
    expect(result.value.key).toBe('10001');
  });

  it('should apply selected facets as filters and return fewer results', async () => {
    // First get all results and pick an active facet value to filter on
    const initial = await provider.queryByTerm({
      search: {
        term: 'chair',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!initial.success)
      assert.fail(`Initial search failed: ${JSON.stringify(initial)}`);

    const brandFacet = initial.value.facets.find(
      (f) => f.identifier.key === 'manufacturer.raw',
    );
    if (!brandFacet || brandFacet.values.length === 0)
      assert.fail('Expected brand facet in results');

    const firstValue = brandFacet.values[0];

    // Now re-query with that facet selected
    const filtered = await provider.queryByTerm({
      search: {
        term: 'chair',
        facets: [firstValue.identifier],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    });

    if (!filtered.success)
      assert.fail(`Filtered search failed: ${JSON.stringify(filtered)}`);

    // Filtered results must be strictly fewer — proves the filter was sent to the API
    expect(filtered.value.totalCount).toBeLessThan(initial.value.totalCount);
    expect(filtered.value.totalCount).toBeGreaterThan(0);

    // The selected facet value should be marked active in the response
    const responseFacet = filtered.value.facets.find(
      (f) => f.identifier.key === 'manufacturer.raw',
    );
    if (!responseFacet)
      assert.fail('Brand facet missing from filtered response');
    const activeValue = responseFacet.values.find(
      (v) => v.identifier.key === firstValue.identifier.key,
    );
    expect(activeValue?.active).toBe(true);
  });
});
