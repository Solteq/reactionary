import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OrderPagedQueryResponse } from '@commercetools/platform-sdk';
import {
  createInitialRequestContext,
  OrderSchema,
  OrderSearchResultSchema,
  type OrderSearchQueryByTerm,
  type OrderStatus,
} from '@reactionary/core';
import { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';
import { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

/**
 * Offline tests for mapping Commercetools order, payment and shipment states to an order status.
 * The fixture is a raw response body from GET /{projectKey}/me/orders, holding one order per state.
 */
const FIXTURES = new URL('./__fixtures__/order-status/', import.meta.url);

function readOrderResponse(name: string): OrderPagedQueryResponse {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

const response = readOrderResponse('customer-orders-by-state.json');

const cases: { id: string; state: string; expected: OrderStatus }[] = [
  { id: 'b76df1b4-7751-4161-adb0-4829121f8b52', state: 'Open', expected: 'AwaitingPayment' },
  { id: '6dda0c42-5836-4c22-a8d3-b90f7e3b45bf', state: 'Confirmed, payment Paid', expected: 'ReleasedToFulfillment' },
  { id: '28b33289-e0b5-4bde-ae67-319826960a0e', state: 'Confirmed, shipment Ready', expected: 'ReleasedToFulfillment' },
  { id: '56148d99-f7f7-4710-98de-7d09d8e85b35', state: 'Cancelled', expected: 'Cancelled' },
  { id: '5fd7d027-7aea-4e3a-81d7-1cabc0fdb8e9', state: 'Complete, shipment Delivered', expected: 'Shipped' },
  { id: '1fcb4f81-061e-4f5a-882b-78d100ff0205', state: 'Complete, no shipment state', expected: 'Shipped' },
];

function getOrder(id: string) {
  const order = response.results.find((candidate) => candidate.id === id);
  if (!order) {
    throw new Error(`Order ${id} is not part of the fixture`);
  }
  return order;
}

describe('Commercetools order status mapping', () => {
  it('has a recorded order for every case', () => {
    expect(response.results.map((order) => order.id).sort()).toEqual(
      cases.map((c) => c.id).sort(),
    );
  });

  describe('order factory', () => {
    const factory = new CommercetoolsOrderFactory(OrderSchema);

    it.each(cases)('maps $state to $expected', ({ id, expected }) => {
      const order = factory.parseOrder(createInitialRequestContext(), getOrder(id));

      expect(order.orderStatus).toBe(expected);
    });
  });

  describe('order search factory', () => {
    const factory = new CommercetoolsOrderSearchFactory(OrderSearchResultSchema);
    const query = {
      search: {
        term: '',
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      },
    } satisfies OrderSearchQueryByTerm;

    it.each(cases)('maps $state to $expected', ({ id, expected }) => {
      const result = factory.parseOrderSearchResult(createInitialRequestContext(), response, query);
      const item = result.items.find((candidate) => candidate.identifier.key === id);

      expect(item?.orderStatus).toBe(expected);
    });
  });
});
