import type { OrderSearchQueryByTerm, RequestContext } from '@reactionary/core';
import { NoOpCache, OrderSearchResultSchema, createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoSalesOrder, MagentoSalesOrderSearchResult } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  defaultCurrency: 'EUR',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
});

function order(entityId: number, overrides: Partial<MagentoSalesOrder> = {}): MagentoSalesOrder {
  return {
    entity_id: entityId,
    increment_id: String(entityId).padStart(9, '0'),
    customer_id: 7,
    customer_firstname: 'Jane',
    customer_lastname: 'Doe',
    status: 'processing',
    state: 'processing',
    created_at: '2026-08-20 10:00:00',
    order_currency_code: 'EUR',
    grand_total: 100,
    billing_address: { firstname: 'Bill', lastname: 'Payer', city: 'Tartu' },
    extension_attributes: {
      shipping_assignments: [
        { shipping: { address: { firstname: 'Jane', lastname: 'Doe', city: 'Tallinn' } } },
      ],
    },
    ...overrides,
  };
}

function list(items: MagentoSalesOrder[], totalCount = items.length): MagentoSalesOrderSearchResult {
  return { items, total_count: totalCount, search_criteria: { page_size: 10, current_page: 1 } };
}

function query(search: Partial<OrderSearchQueryByTerm['search']> = {}): OrderSearchQueryByTerm {
  return {
    search: {
      term: '',
      filters: [],
      paginationOptions: { pageSize: 10, pageNumber: 1 },
      ...search,
    },
  };
}

/** The searchCriteria filters of a request, as `field condition value`. */
function filtersOf(params: URLSearchParams): string[] {
  const filters: string[] = [];
  for (let group = 0; params.has(`searchCriteria[filterGroups][${group}][filters][0][field]`); group += 1) {
    const prefix = `searchCriteria[filterGroups][${group}][filters][0]`;
    filters.push(
      `${params.get(`${prefix}[field]`)} ${params.get(`${prefix}[condition_type]`)} ${params.get(`${prefix}[value]`)}`,
    );
  }
  return filters;
}

describe('MagentoOrderSearchCapability', () => {
  let reqCtx: RequestContext;
  let client: MagentoClient;
  let capability: MagentoOrderSearchCapability;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unexpected network call')));
    reqCtx = createInitialRequestContext();
    client = new MagentoClient(config, reqCtx);
    capability = new MagentoOrderSearchCapability(
      config,
      new NoOpCache(),
      reqCtx,
      client,
      new MagentoOrderSearchFactory(OrderSearchResultSchema),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('always scopes the search to the signed-in customer', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const searchOrders = vi.spyOn(client, 'searchOrders').mockResolvedValue(list([order(1)]));

    const result = await capability.queryByTerm(query());

    expect(filtersOf(searchOrders.mock.calls[0][0])).toEqual(['customer_id eq 7']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0].shippingAddress).toMatchObject({ city: 'Tallinn' });
      expect(result.value.items[0].orderDate).toBe('2026-08-20T10:00:00.000Z');
    }
  });

  it('reports a guest search as a Generic error without querying orders', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(null);
    const searchOrders = vi.spyOn(client, 'searchOrders');

    const result = await capability.queryByTerm(query());

    expect(searchOrders).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('reports a failed customer lookup as an error rather than an empty result', async () => {
    vi.spyOn(client, 'getCustomerId').mockRejectedValue(
      new MagentoApiError({ transport: 'rest', status: 503, method: 'GET', url: '/V1/customers/me' }),
    );

    const result = await capability.queryByTerm(query());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('refuses to return orders of another customer', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    vi.spyOn(client, 'searchOrders').mockResolvedValue(list([order(1), order(2, { customer_id: 8 })]));

    const result = await capability.queryByTerm(query());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('rejects a user other than the signed-in customer', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const searchOrders = vi.spyOn(client, 'searchOrders').mockResolvedValue(list([]));

    const other = await capability.queryByTerm(query({ user: { userId: '8' } }));
    const self = await capability.queryByTerm(query({ user: { userId: '7' } }));

    expect(other.success).toBe(false);
    if (!other.success) {
      expect(other.error.type).toBe('InvalidInput');
    }
    expect(self.success).toBe(true);
    expect(searchOrders).toHaveBeenCalledTimes(1);
  });

  it('rejects company-wide searches and unsupported filters', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const searchOrders = vi.spyOn(client, 'searchOrders').mockResolvedValue(list([]));

    const company = await capability.queryByTerm(query({ company: { taxIdentifier: 'EE123' } }));
    const filters = await capability.queryByTerm(query({ filters: ['channel:web'] }));

    expect(company.success).toBe(false);
    expect(filters.success).toBe(false);
    if (!company.success && !filters.success) {
      expect(company.error.type).toBe('InvalidInput');
      expect(filters.error.type).toBe('InvalidInput');
    }
    expect(searchOrders).not.toHaveBeenCalled();
  });

  it('translates term, statuses and dates into Magento filters', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const searchOrders = vi.spyOn(client, 'searchOrders').mockResolvedValue(list([]));

    await capability.queryByTerm(
      query({
        term: '10%_',
        orderStatus: ['AwaitingPayment', 'Shipped'],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    );

    expect(filtersOf(searchOrders.mock.calls[0][0])).toEqual([
      'customer_id eq 7',
      'increment_id like %10\\%\\_%',
      'state in new,pending_payment,payment_review,holded,complete',
      'created_at gteq 2026-08-01 00:00:00',
      'created_at lteq 2026-08-31 23:59:59',
    ]);
  });

  it('converts timestamp bounds to Magento UTC datetimes', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const searchOrders = vi.spyOn(client, 'searchOrders').mockResolvedValue(list([]));

    await capability.queryByTerm(query({ endDate: '2026-08-31T12:30:00+02:00' }));

    expect(filtersOf(searchOrders.mock.calls[0][0])).toContain('created_at lteq 2026-08-31 10:30:00');
  });

  it('rejects an unparseable date', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);

    const result = await capability.queryByTerm(query({ startDate: 'last tuesday' }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  describe('part number search', () => {
    it('filters on sales order items server side and keeps the total exact', async () => {
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
      const searchOrders = vi
        .spyOn(client, 'searchOrders')
        .mockImplementation(async (params) => {
          if (params.get('fields') === 'items[entity_id],total_count') {
            return list([order(5), order(4), order(3), order(2), order(1)]);
          }
          return list([order(4), order(2)]);
        });
      const adminRequest = vi.spyOn(client, 'adminRequest').mockResolvedValue({
        items: [
          { order_id: 4, sku: 'A' },
          { order_id: 4, sku: 'B' },
          { order_id: 3, sku: 'A' },
          { order_id: 2, sku: 'A' },
          { order_id: 2, sku: 'B' },
          { order_id: 1, sku: 'B' },
        ],
        total_count: 6,
      });

      const result = await capability.queryByTerm(
        query({ partNumber: ['A', 'B'], paginationOptions: { pageSize: 10, pageNumber: 1 } }),
      );

      const [method, path] = adminRequest.mock.calls[0];
      expect(method).toBe('GET');
      const itemParams = new URLSearchParams(path.slice(path.indexOf('?') + 1));
      expect(path.startsWith('/V1/orders/items?')).toBe(true);
      expect(filtersOf(itemParams)).toEqual(['order_id in 5,4,3,2,1', 'sku in A,B']);

      const idParams = searchOrders.mock.calls[0][0];
      expect(filtersOf(idParams)[0]).toBe('customer_id eq 7');

      const pageParams = searchOrders.mock.calls[1][0];
      expect(filtersOf(pageParams)).toEqual(['customer_id eq 7', 'entity_id in 4,2']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalCount).toBe(2);
        expect(result.value.items.map((item) => item.identifier.key)).toEqual(['4', '2']);
      }
    });

    it('pages over the matching orders', async () => {
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
      const searchOrders = vi
        .spyOn(client, 'searchOrders')
        .mockImplementation(async (params) => {
          if (params.get('fields') === 'items[entity_id],total_count') {
            return list([order(3), order(2), order(1)]);
          }
          return list([order(1)]);
        });
      vi.spyOn(client, 'adminRequest').mockResolvedValue({
        items: [
          { order_id: 3, sku: 'A' },
          { order_id: 2, sku: 'A' },
          { order_id: 1, sku: 'A' },
        ],
        total_count: 3,
      });

      const result = await capability.queryByTerm(
        query({ partNumber: ['A'], paginationOptions: { pageSize: 2, pageNumber: 2 } }),
      );

      expect(filtersOf(searchOrders.mock.calls[1][0])).toEqual(['customer_id eq 7', 'entity_id in 1']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalCount).toBe(3);
        expect(result.value.totalPages).toBe(2);
        expect(result.value.pageNumber).toBe(2);
      }
    });

    it('asks for a narrower search beyond the scan limit', async () => {
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
      vi.spyOn(client, 'searchOrders').mockResolvedValue(list([order(1)], 100_000));

      const result = await capability.queryByTerm(query({ partNumber: ['A'] }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('InvalidInput');
      }
    });
  });
});
