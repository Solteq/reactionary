import type {
  Address,
  Currency,
  IdentityIdentifier,
  MonetaryAmount,
  OrderSearchIdentifier,
  OrderSearchQueryByTerm,
  OrderSearchResult,
  OrderSearchResultItem,
  OrderStatus,
} from '@reactionary/core';
import type {
  Address as CTAddress,
  Order as CTOrder,
  OrderPagedQueryResponse,
} from '@commercetools/platform-sdk';

function parseAddress(remote: CTAddress): Address {
  return {
    countryCode: remote.country || '',
    firstName: remote.firstName || '',
    lastName: remote.lastName || '',
    streetAddress: remote.streetName || '',
    streetNumber: remote.streetNumber || '',
    postalCode: remote.postalCode || '',
    city: remote.city || '',
    identifier: {
      nickName: '',
    },
    region: '',
  } satisfies Address;
}

function parseSingle(body: CTOrder, currencyCode: string): OrderSearchResultItem {
  const identifier = { key: body.id };
  const userId: IdentityIdentifier = {
    userId: body.customerId || body.anonymousId || '',
  };
  const customerName = `${body.billingAddress?.firstName} ${body.billingAddress?.lastName}`;
  const shippingAddress = parseAddress(body.shippingAddress!);
  const orderDate = body.createdAt;
  let orderStatus: OrderStatus = 'AwaitingPayment';
  if (body.paymentState === 'Pending' && body.orderState === 'Open') {
    orderStatus = 'AwaitingPayment';
  } else if (
    body.paymentState === 'Paid' &&
    body.orderState === 'Confirmed'
  ) {
    orderStatus = 'ReleasedToFulfillment';
  }
  if (body.shipmentState === 'Ready' && body.orderState === 'Confirmed') {
    orderStatus = 'ReleasedToFulfillment';
  }
  if (
    (body.shipmentState === 'Shipped' ||
      body.shipmentState === 'Delivered') &&
    body.orderState === 'Completed'
  ) {
    orderStatus = 'Shipped';
  }
  const inventoryStatus: OrderSearchResultItem['inventoryStatus'] =
    orderStatus === 'Shipped' ? 'Allocated' : 'NotAllocated';

  const totalAmount: MonetaryAmount = {
    currency: body.totalPrice ? body.totalPrice.currencyCode as Currency : currencyCode as Currency,
    value: body.totalPrice ? body.totalPrice.centAmount / 100 : 0,
  };

  return {
    identifier,
    userId,
    customerName,
    shippingAddress,
    orderDate,
    orderStatus,
    inventoryStatus,
    totalAmount,
  } satisfies OrderSearchResultItem;
}

export function parseCommercetoolsOrderSearchResult(
  body: OrderPagedQueryResponse,
  query: OrderSearchQueryByTerm,
  currencyCode: string,
): OrderSearchResult {
  const identifier = {
    ...query.search,
  } satisfies OrderSearchIdentifier;

  const items = body.results.map((o) => parseSingle(o, currencyCode));

  return {
    identifier,
    pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
    pageSize: body.limit,
    totalCount: body.total || 0,
    totalPages: Math.ceil((body.total || 0) / body.limit || 0) + 1,
    items,
  } satisfies OrderSearchResult;
}
