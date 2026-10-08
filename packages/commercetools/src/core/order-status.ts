import type { OrderState } from '@commercetools/platform-sdk';
import type { OrderStatus } from '@reactionary/core';

/**
 * Maps a Commercetools order state to an order status.
 *
 * This is the inverse of the order state filter applied by order search, so orders
 * found by searching for a status are also reported with that status.
 */
export function getOrderStatusFromOrderState(orderState: OrderState): OrderStatus {
  switch (orderState) {
    case 'Cancelled':
      return 'Cancelled';
    case 'Complete':
      return 'Shipped';
    case 'Confirmed':
      return 'ReleasedToFulfillment';
    default:
      return 'AwaitingPayment';
  }
}
