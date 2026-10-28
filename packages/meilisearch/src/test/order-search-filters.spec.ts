import { describe, expect, it } from 'vitest';
import {
  NoOpCache,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { OrderSearchQueryByTerm } from '@reactionary/core';
import { MeilisearchOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

class TestableOrderSearchCapability extends MeilisearchOrderSearchCapability {
  public buildSearchParams(payload: OrderSearchQueryByTerm, scopedUserIds: string[]) {
    return this.queryByTermPayload(payload, scopedUserIds);
  }
}

class StricterEscapingCapability extends TestableOrderSearchCapability {
  protected override escapeFilterValue(value: string): string {
    return super.escapeFilterValue(value).replace(/'/g, "\\'");
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const createCapability = (type: typeof TestableOrderSearchCapability = TestableOrderSearchCapability) =>
  new type(
    config,
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchOrderSearchFactory(OrderSearchResultSchema),
  );

const createPayload = (search: Partial<OrderSearchQueryByTerm['search']>): OrderSearchQueryByTerm =>
  OrderSearchQueryByTermSchema.parse({
    search: {
      term: '',
      filters: [],
      paginationOptions: { pageNumber: 1, pageSize: 20 },
      ...search,
    },
  });

/**
 * Removes every quoted string, honouring backslash escapes the way Meilisearch's filter parser does. What is left is
 * the structure of the expression.
 */
const withoutQuotedStrings = (filter: unknown): string => {
  expect(typeof filter).toBe('string');
  return String(filter).replace(/"(?:[^"\\]|\\.)*"/g, '""');
};

describe('MeilisearchOrderSearchCapability filters', () => {
  it('builds the expected filter for ordinary input', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        orderStatus: ['Shipped', 'Cancelled'],
        partNumber: ['SKU-1', 'SKU-2'],
      }),
      ['user-1'],
    );
    expect(params.filter).toBe(
      'userIdentifier = "user-1" AND (orderStatus = "shipped" OR orderStatus = "cancelled") AND (items.sku = "SKU-1" OR items.sku = "SKU-2")',
    );
  });

  it('keeps a user id containing a quote and an OR clause inside its string', () => {
    const params = createCapability().buildSearchParams(createPayload({}), ['x" OR userIdentifier != "']);
    expect(params.filter).toBe('userIdentifier = "x\\" OR userIdentifier != \\""');
    expect(withoutQuotedStrings(params.filter)).toBe('userIdentifier = ""');
  });

  it('keeps a part number containing a quote and an OR clause inside its string', () => {
    const params = createCapability().buildSearchParams(
      createPayload({ partNumber: ['x" OR userIdentifier != "', 'SKU-2'] }),
      ['user-1'],
    );
    expect(params.filter).toBe(
      'userIdentifier = "user-1" AND (items.sku = "x\\" OR userIdentifier != \\"" OR items.sku = "SKU-2")',
    );
    expect(withoutQuotedStrings(params.filter)).toBe('userIdentifier = "" AND (items.sku = "" OR items.sku = "")');
  });

  it('escapes backslashes so a trailing backslash cannot escape the closing quote', () => {
    const params = createCapability().buildSearchParams(
      createPayload({ partNumber: ['a\\" OR items.sku != "'] }),
      ['user-1\\'],
    );
    expect(params.filter).toBe(
      'userIdentifier = "user-1\\\\" AND (items.sku = "a\\\\\\" OR items.sku != \\"")',
    );
    expect(withoutQuotedStrings(params.filter)).toBe('userIdentifier = "" AND (items.sku = "")');
  });

  it('lets a subclass override the escaping', () => {
    const params = createCapability(StricterEscapingCapability).buildSearchParams(createPayload({}), ["o'neil"]);
    expect(params.filter).toBe(`userIdentifier = "o\\'neil"`);
  });
});
