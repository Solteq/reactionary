import {
  AddressIdentifierSchema,
  type Address,
  type AnyOrderSearchResultSchema,
  type Currency,
  type IdentityIdentifier,
  type MonetaryAmount,
  type OrderInventoryStatus,
  type OrderSearchFactory,
  type OrderSearchIdentifier,
  type OrderSearchQueryByTerm,
  type OrderSearchResult,
  type OrderSearchResultItem,
  type OrderSearchResultSchema,
  type OrderStatus,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MagentoOrderAddress {
  firstname?: string;
  lastname?: string;
  street?: string[];
  city?: string;
  region?: string;
  region_code?: string;
  postcode?: string;
  country_id?: string;
  entity_id?: number;
}

export interface MagentoOrder {
  entity_id: number;
  increment_id?: string;
  customer_id?: number;
  customer_email?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  status?: string;
  state?: string;
  grand_total?: number;
  order_currency_code?: string;
  created_at?: string;
  billing_address?: MagentoOrderAddress;
}

export interface MagentoOrderListResponse {
  items?: MagentoOrder[];
  total_count?: number;
  search_criteria?: { page_size?: number; current_page?: number };
}

export function mapMagentoOrderStatus(status?: string): OrderStatus {
  switch (status) {
    case 'processing':
      return 'ReleasedToFulfillment';
    case 'complete':
    case 'closed':
      return 'Shipped';
    case 'canceled':
      return 'Cancelled';
    default:
      return 'AwaitingPayment';
  }
}

export class MagentoOrderSearchFactory<
  TOrderSearchResultSchema extends
    AnyOrderSearchResultSchema = typeof OrderSearchResultSchema,
> implements OrderSearchFactory<TOrderSearchResultSchema>
{
  public readonly orderSearchResultSchema: TOrderSearchResultSchema;

  constructor(orderSearchResultSchema: TOrderSearchResultSchema) {
    this.orderSearchResultSchema = orderSearchResultSchema;
  }

  protected parseAddress(address: MagentoOrderAddress): Address {
    const street = address.street ?? [];
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: address.entity_id ? String(address.entity_id) : 'billing',
      }),
      firstName: address.firstname || '',
      lastName: address.lastname || '',
      streetAddress: street[0] || '',
      streetNumber: street[1] || '',
      city: address.city || '',
      region: address.region || '',
      postalCode: address.postcode || '',
      countryCode: address.country_id || '',
    };
  }

  protected parseOrderSearchResultItem(
    _context: RequestContext,
    order: MagentoOrder,
  ): OrderSearchResultItem {
    const totalAmount: MonetaryAmount = {
      currency: (order.order_currency_code || 'USD').toUpperCase() as Currency,
      value: order.grand_total ?? 0,
    };

    const inventoryStatus: OrderInventoryStatus =
      order.state === 'complete' ? 'Allocated' : 'NotAllocated';

    const userId: IdentityIdentifier = {
      userId: order.customer_id ? String(order.customer_id) : '',
    };

    return {
      identifier: { key: String(order.entity_id) },
      userId,
      customerName:
        `${order.customer_firstname ?? ''} ${order.customer_lastname ?? ''}`.trim(),
      shippingAddress: order.billing_address
        ? this.parseAddress(order.billing_address)
        : undefined,
      orderDate: new Date(order.created_at || Date.now()).toISOString(),
      orderStatus: mapMagentoOrderStatus(order.status),
      inventoryStatus,
      totalAmount,
    } satisfies OrderSearchResultItem;
  }

  public parseOrderSearchResult(
    context: RequestContext,
    data: unknown,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    const response = data as MagentoOrderListResponse;
    const items = response.items ?? [];
    const pageSize =
      response.search_criteria?.page_size ||
      query.search.paginationOptions.pageSize;
    const pageNumber =
      response.search_criteria?.current_page ||
      query.search.paginationOptions.pageNumber;
    const totalCount = response.total_count ?? items.length;

    const identifier = { ...query.search } satisfies OrderSearchIdentifier;

    const result = {
      identifier,
      pageNumber,
      pageSize,
      totalCount,
      totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
      items: items.map((o) => this.parseOrderSearchResultItem(context, o)),
    } satisfies OrderSearchResult;

    return this.orderSearchResultSchema.parse(result);
  }
}
