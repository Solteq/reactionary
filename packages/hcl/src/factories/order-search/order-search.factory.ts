import type {
  AnyOrderSearchResultSchema,
  Currency,
  IdentityIdentifier,
  MonetaryAmount,
  OrderInventoryStatus,
  OrderSearchFactory,
  OrderSearchIdentifier,
  OrderSearchQueryByTerm,
  OrderSearchResult,
  OrderSearchResultItem,
  OrderSearchResultSchema,
  OrderStatus,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  HclWcsCartResponse,
  HclWcsOrderListResponse,
} from '../../schema/hcl.schema.js';

function mapWcsOrderStatus(status: string): OrderStatus {
  switch (status) {
    case 'S':
      return 'Shipped';
    case 'X':
    case 'R':
    case 'D':
      return 'Cancelled';
    case 'M':
    case 'G':
    case 'F':
      return 'ReleasedToFulfillment';
    default:
      return 'AwaitingPayment';
  }
}

export class HclOrderSearchFactory<
  TOrderSearchResultSchema extends
    AnyOrderSearchResultSchema = typeof OrderSearchResultSchema,
> implements OrderSearchFactory<TOrderSearchResultSchema>
{
  public readonly orderSearchResultSchema: TOrderSearchResultSchema;

  constructor(orderSearchResultSchema: TOrderSearchResultSchema) {
    this.orderSearchResultSchema = orderSearchResultSchema;
  }

  public parseOrderSearchResult(
    context: RequestContext,
    data: HclWcsOrderListResponse,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    const items = (data.Order ?? []).map((o) =>
      this.parseOrderSearchResultItem(context, o),
    );
    const totalCount = Number(data.recordSetTotal ?? items.length);
    const { pageSize, pageNumber } = query.search.paginationOptions;

    const result = {
      identifier: { ...query.search } satisfies OrderSearchIdentifier,
      items,
      totalCount,
      pageSize,
      pageNumber,
      totalPages: Math.ceil(totalCount / Math.max(1, pageSize)),
    } satisfies OrderSearchResult;

    return this.orderSearchResultSchema.parse(result);
  }

  protected parseOrderSearchResultItem(
    _context: RequestContext,
    item: HclWcsCartResponse,
  ): OrderSearchResultItem {
    const orderStatus = mapWcsOrderStatus(item.orderStatus ?? '');
    const inventoryStatus: OrderInventoryStatus =
      orderStatus === 'Shipped' ? 'Allocated' : 'NotAllocated';
    const userId: IdentityIdentifier = { userId: item.buyerId ?? '' };
    const totalAmount: MonetaryAmount = {
      value: Number(item.grandTotal ?? '0'),
      currency: (item.grandTotalCurrency ?? 'USD') as Currency,
    };

    return {
      identifier: { key: item.orderId },
      userId,
      customerName: '',
      orderDate: item.lastUpdateDate ?? '',
      orderStatus,
      inventoryStatus,
      totalAmount,
    } satisfies OrderSearchResultItem;
  }
}
