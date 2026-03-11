import type {
  StoreOrder,
  StoreOrderAddress,
  StoreOrderListResponse,
} from '@medusajs/types';
import {
  AddressIdentifierSchema,
  type Address,
  type AddressIdentifier,
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

export class MedusaOrderSearchFactory<
  TOrderSearchResultSchema extends
    AnyOrderSearchResultSchema = typeof OrderSearchResultSchema,
> implements OrderSearchFactory<TOrderSearchResultSchema>
{
  public readonly orderSearchResultSchema: TOrderSearchResultSchema;

  constructor(orderSearchResultSchema: TOrderSearchResultSchema) {
    this.orderSearchResultSchema = orderSearchResultSchema;
  }

  protected parseOrderSearchResultItem(
    context: RequestContext,
    body: StoreOrder,
  ) {
    const identifier = { key: body.id };
    const userId: IdentityIdentifier = {
      userId: body.customer_id || '',
    };
    const customerName = `${body.billing_address?.first_name} ${body.billing_address?.last_name}`;
    const shippingAddress = this.parseAddress(context, body.shipping_address!);
    const orderDate = new Date(body.created_at).toISOString();

    let orderStatus: OrderStatus = 'AwaitingPayment';
    if (body.status === 'draft') {
      orderStatus = 'AwaitingPayment';
    }
    if (body.status === 'pending') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (body.status === 'completed') {
      orderStatus = 'Shipped';
    }
    if (body.status === 'canceled') {
      orderStatus = 'Cancelled';
    }
    let inventoryStatus: OrderInventoryStatus = 'NotAllocated';
    // Medusa does not have direct mapping for inventory status on orders
    // This is a placeholder logic and may need to be adjusted based on actual requirements
    if (body.fulfillment_status === 'fulfilled') {
      inventoryStatus = 'Allocated';
    }

    const totalAmount: MonetaryAmount = {
      currency: body.currency_code.toUpperCase() as Currency,
      value: body.total ? body.total : 0,
    };

    const order = {
      identifier,
      userId,
      customerName,
      shippingAddress,
      orderDate,
      orderStatus,
      inventoryStatus,
      totalAmount,
    } satisfies OrderSearchResultItem;

    return order;
  }

  protected parseAddress(
    _context: RequestContext,
    storeAddress: StoreOrderAddress,
  ): Address {
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: storeAddress.id,
      } satisfies AddressIdentifier),
      firstName: storeAddress.first_name || '',
      lastName: storeAddress.last_name || '',
      streetAddress: storeAddress.address_1 || '',
      streetNumber: storeAddress.address_2 || '',
      city: storeAddress.city || '',
      postalCode: storeAddress.postal_code || '',
      countryCode: storeAddress.country_code || '',
      region: '',
    };
  }

  public parseOrderSearchResult(
    _context: RequestContext,
    data: StoreOrderListResponse,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    const identifier = {
      ...query.search,
    } satisfies OrderSearchIdentifier;

    const orders: OrderSearchResultItem[] = data.orders.map((o) => {
      return this.parseOrderSearchResultItem(_context, o);
    });

    const result = {
      identifier,
      pageNumber: (Math.ceil(data.offset / data.limit) || 0) + 1,
      pageSize: data.limit,
      totalCount: data.count,
      totalPages: Math.ceil(data.count / data.limit || 0) + 1,
      items: orders,
    } satisfies OrderSearchResult;

    return this.orderSearchResultSchema.parse(result);
  }
}
