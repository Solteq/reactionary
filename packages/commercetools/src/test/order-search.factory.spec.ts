import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OrderPagedQueryResponse } from '@commercetools/platform-sdk';
import {
  createInitialRequestContext,
  OrderSearchResultSchema,
  type OrderSearchQueryByTerm,
} from '@reactionary/core';
import { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

/**
 * Offline tests for mapping recorded Commercetools order search responses.
 * Fixtures are raw response bodies from GET /{projectKey}/me/orders?withTotal=true.
 */
const FIXTURES = new URL('./__fixtures__/order-search/', import.meta.url);

function readOrderResponse(name: string): OrderPagedQueryResponse {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

function setup() {
  const context = createInitialRequestContext();
  const factory = new CommercetoolsOrderSearchFactory(OrderSearchResultSchema);
  const query = {
    search: {
      term: '',
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 5,
      },
    },
  } satisfies OrderSearchQueryByTerm;

  return { context, factory, query };
}

describe('Commercetools order search factory', () => {
  // Recorded with limit=5, offset=0 for a customer with 19 orders.
  const response = readOrderResponse('customer-orders-limit-5.json');

  it('maps the orders of a recorded response', () => {
    const { context, factory, query } = setup();

    const result = factory.parseOrderSearchResult(context, response, query);

    expect(result.items.map((item) => item.identifier.key)).toEqual(
      response.results.map((order) => order.id),
    );
  });

  it('rounds up to include a partially filled last page', () => {
    const { context, factory, query } = setup();

    const result = factory.parseOrderSearchResult(context, response, query);

    expect(result.totalCount).toBe(19);
    expect(result.pageSize).toBe(5);
    expect(result.pageNumber).toBe(1);
    expect(result.totalPages).toBe(4);
  });

  it('does not add a page when the total fills the last page exactly', () => {
    const { context, factory, query } = setup();

    const result = factory.parseOrderSearchResult(context, { ...response, total: 20 }, query);

    expect(result.totalPages).toBe(4);
  });

  it('reports no pages when there are no orders', () => {
    const { context, factory, query } = setup();

    const result = factory.parseOrderSearchResult(
      context,
      { ...response, total: 0, count: 0, results: [] },
      query,
    );

    expect(result.totalPages).toBe(0);
  });
});
