import type {
  CostBreakDown,
  Currency,
  ItemCostBreakdown,
  Order,
  OrderIdentifier,
  OrderItem,
  OrderStatus,
  ProductVariantIdentifier,
} from '@reactionary/core';
import type { Order as CTOrder } from '@commercetools/platform-sdk';

export function parseCommercetoolsOrder(remote: CTOrder): Order {
  const identifier = {
    key: remote.id,
  } satisfies OrderIdentifier;

  const name = remote.custom?.fields['name'] || '';
  const description = remote.custom?.fields['description'] || '';

  const grandTotal = remote.totalPrice.centAmount || 0;
  const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
  const productTotal = grandTotal - shippingTotal;
  const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
  const discountTotal =
    remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
  const surchargeTotal = 0;
  const currency = remote.totalPrice.currencyCode as Currency;

  const price = {
    totalTax: {
      value: taxTotal / 100,
      currency,
    },
    totalDiscount: {
      value: discountTotal / 100,
      currency,
    },
    totalSurcharge: {
      value: surchargeTotal / 100,
      currency,
    },
    totalShipping: {
      value: shippingTotal / 100,
      currency: remote.shippingInfo?.price.currencyCode as Currency,
    },
    totalProductPrice: {
      value: productTotal / 100,
      currency,
    },
    grandTotal: {
      value: grandTotal / 100,
      currency,
    },
  } satisfies CostBreakDown;

  let orderStatus: OrderStatus = 'AwaitingPayment';
  if (remote.paymentState === 'Pending' && remote.orderState === 'Open') {
    orderStatus = 'AwaitingPayment';
  } else if (
    remote.paymentState === 'Paid' &&
    remote.orderState === 'Confirmed'
  ) {
    orderStatus = 'ReleasedToFulfillment';
  }
  if (remote.shipmentState === 'Ready' && remote.orderState === 'Confirmed') {
    orderStatus = 'ReleasedToFulfillment';
  }
  if (
    (remote.shipmentState === 'Shipped' ||
      remote.shipmentState === 'Delivered') &&
    remote.orderState === 'Completed'
  ) {
    orderStatus = 'Shipped';
  }

  const items = new Array<OrderItem>();
  for (const remoteItem of remote.lineItems) {
    const itemIdentifier = {
      key: remoteItem.id,
    } satisfies OrderIdentifier;

    const variant = {
      sku: remoteItem.variant.sku || '',
    } satisfies ProductVariantIdentifier;
    const quantity = remoteItem.quantity;

    const unitPrice = remoteItem.price.value.centAmount;
    const totalPrice = remoteItem.totalPrice.centAmount || 0;
    const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
    const unitDiscount = totalDiscount / remoteItem.quantity;

    const itemPrice = {
      unitPrice: {
        value: unitPrice / 100,
        currency,
      },
      unitDiscount: {
        value: unitDiscount / 100,
        currency,
      },
      totalPrice: {
        value: (totalPrice || 0) / 100,
        currency,
      },
      totalDiscount: {
        value: totalDiscount / 100,
        currency,
      },
    } satisfies ItemCostBreakdown;

    const item = {
      identifier: itemIdentifier,
      inventoryStatus: 'NotAllocated',
      price: itemPrice,
      quantity,
      variant,
    } satisfies OrderItem;

    items.push(item);
  }

  return {
    identifier,
    name,
    description,
    price,
    items,
    inventoryStatus: 'NotAllocated',
    paymentInstructions: [],
    userId: {
      userId: '',
    },
    orderStatus,
  } satisfies Order;
}
