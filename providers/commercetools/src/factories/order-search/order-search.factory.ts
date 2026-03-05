import type {
  Address as CTAddress,
  Order as CTOrder,
  OrderPagedQueryResponse,
} from '@commercetools/platform-sdk';
import type {
  OrderSearchResultSchema} from '@reactionary/core';
import {
  type Address,
  type AnyOrderSearchResultSchema,
  type Currency,
  type IdentityIdentifier,
  type MonetaryAmount,
  type OrderSearchFactory,
  type OrderSearchQueryByTerm,
  type OrderSearchResult,
  type OrderSearchResultItem,
  type OrderStatus,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsOrderSearchFactory<
  TOrderSearchResultSchema extends AnyOrderSearchResultSchema = typeof OrderSearchResultSchema,
> implements OrderSearchFactory<TOrderSearchResultSchema>
{
  public readonly orderSearchResultSchema: TOrderSearchResultSchema;

  constructor(orderSearchResultSchema: TOrderSearchResultSchema) {
    this.orderSearchResultSchema = orderSearchResultSchema;
  }

  public parseOrderSearchResult(
    context: RequestContext,
    data: OrderPagedQueryResponse,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    const result = {
      identifier: {
        ...query.search,
      },
      pageNumber: (Math.ceil(data.offset / data.limit) || 0) + 1,
      pageSize: data.limit,
      totalCount: data.total || 0,
      totalPages: Math.ceil((data.total || 0) / data.limit || 0) + 1,
      items: data.results.map((order) => this.parseOrderSearchItem(context, order)),
    } satisfies OrderSearchResult;

    return this.orderSearchResultSchema.parse(result);
  }

  protected parseAddress(data: CTAddress): Address {
    return {
      countryCode: data.country || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      streetAddress: data.streetName || '',
      streetNumber: data.streetNumber || '',
      postalCode: data.postalCode || '',
      city: data.city || '',
      identifier: {
        nickName: '',
      },
      region: '',
    } satisfies Address;
  }

  protected parseOrderSearchItem(
    context: RequestContext,
    data: CTOrder,
  ): OrderSearchResultItem {
    const userId: IdentityIdentifier = {
      userId: data.customerId || data.anonymousId || '',
    };

    let orderStatus: OrderStatus = 'AwaitingPayment';
    if (data.paymentState === 'Paid' && data.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (data.shipmentState === 'Ready' && data.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (
      (data.shipmentState === 'Shipped' || data.shipmentState === 'Delivered') &&
      data.orderState === 'Completed'
    ) {
      orderStatus = 'Shipped';
    }

    const totalAmount: MonetaryAmount = {
      currency: data.totalPrice
        ? (data.totalPrice.currencyCode as Currency)
        : context.languageContext.currencyCode,
      value: data.totalPrice ? data.totalPrice.centAmount / 100 : 0,
    };

    return {
      identifier: { key: data.id },
      userId,
      customerName: `${data.billingAddress?.firstName} ${data.billingAddress?.lastName}`,
      shippingAddress: this.parseAddress(data.shippingAddress!),
      orderDate: data.createdAt,
      orderStatus,
      inventoryStatus: orderStatus === 'Shipped' ? 'Allocated' : 'NotAllocated',
      totalAmount,
    } satisfies OrderSearchResultItem;
  }
}
