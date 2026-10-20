import {
  createInitialRequestContext,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MedusaOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

describe('Medusa search pagination (reactionary-cnq.7)', () => {
  describe('product search', () => {
    const factory = new MedusaProductSearchFactory(ProductSearchResultSchema);
    const query = ProductSearchQueryByTermSchema.parse({
      search: {
        term: 'test',
        paginationOptions: { pageNumber: 1, pageSize: 10 },
        facets: [],
        filters: [],
      },
    });

    it('does not add an extra page beyond what count/limit needs', () => {
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        { products: [], count: 25, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(3);
    });

    it('matches an exact multiple of the page size', () => {
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        { products: [], count: 20, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(2);
    });

    it('is 0 when there are no results', () => {
      const result = factory.parseSearchResult(
        createInitialRequestContext(),
        { products: [], count: 0, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(0);
    });
  });

  describe('order search', () => {
    const factory = new MedusaOrderSearchFactory(OrderSearchResultSchema);
    const query = OrderSearchQueryByTermSchema.parse({
      search: {
        term: 'test',
        paginationOptions: { pageNumber: 1, pageSize: 10 },
        filters: [],
      },
    });

    it('does not add an extra page beyond what count/limit needs', () => {
      const result = factory.parseOrderSearchResult(
        createInitialRequestContext(),
        { orders: [], count: 25, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(3);
    });

    it('matches an exact multiple of the page size', () => {
      const result = factory.parseOrderSearchResult(
        createInitialRequestContext(),
        { orders: [], count: 20, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(2);
    });

    it('is 0 when there are no results', () => {
      const result = factory.parseOrderSearchResult(
        createInitialRequestContext(),
        { orders: [], count: 0, offset: 0, limit: 10 },
        query,
      );

      expect(result.totalPages).toBe(0);
    });
  });
});
