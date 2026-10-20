import type {
  Address,
  AnyOrderSearchResultSchema,
  IdentityIdentifier,
  MonetaryAmount,
  OrderSearchFactory,
  OrderSearchIdentifier,
  OrderSearchQueryByTerm,
  OrderSearchResult,
  OrderSearchResultItem,
  OrderSearchResultSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import {
  MagentoOrderListResponseSchema,
  type MagentoOrder,
  type MagentoOrderAddress,
} from '../../schema/order.types.js';
import {
  magentoOrderInventoryStatus,
  magentoOrderShippingAddress,
  mapMagentoOrderStatus,
  parseMagentoDate,
  parseMagentoOrderAddress,
  resolveMagentoOrderCurrency,
} from '../order/order-mapping.js';

export type {
  MagentoOrder,
  MagentoOrderAddress,
  MagentoOrderListResponse,
} from '../../schema/order.types.js';
export { mapMagentoOrderStatus } from '../order/order-mapping.js';

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
    return parseMagentoOrderAddress(address, 'shipping');
  }

  protected parseOrderSearchResultItem(
    context: RequestContext,
    order: MagentoOrder,
  ): OrderSearchResultItem {
    const totalAmount: MonetaryAmount = {
      currency: resolveMagentoOrderCurrency(order.order_currency_code, context),
      value: order.grand_total ?? 0,
    };

    const userId: IdentityIdentifier = {
      userId: order.customer_id ? String(order.customer_id) : '',
    };

    const customerName =
      `${order.customer_firstname ?? ''} ${order.customer_lastname ?? ''}`.trim() ||
      `${order.billing_address?.firstname ?? ''} ${order.billing_address?.lastname ?? ''}`.trim();

    const shippingAddress = magentoOrderShippingAddress(order);

    return {
      identifier: { key: String(order.entity_id) },
      userId,
      customerName,
      shippingAddress: shippingAddress ? this.parseAddress(shippingAddress) : undefined,
      orderDate: parseMagentoDate(order.created_at),
      orderStatus: mapMagentoOrderStatus(order.status, order.state),
      inventoryStatus: magentoOrderInventoryStatus(order),
      totalAmount,
    } satisfies OrderSearchResultItem;
  }

  public parseOrderSearchResult(
    context: RequestContext,
    data: unknown,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    const response = MagentoOrderListResponseSchema.parse(data);
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
