import { describe, expect, it } from 'vitest';
import {
  AnalyticsMutationOrderPlacedSchema,
  CheckoutSchema,
  CostBreakDownSchema,
  OrderSchema,
  summarizePlacedOrder,
} from '../index.js';

const checkout = CheckoutSchema.parse({
  identifier: { key: 'checkout-1' },
  originalCartReference: { key: 'cart-1' },
  pointOfContact: { email: 'shopper@example.com' },
  items: [{ identifier: { key: 'i1' }, variant: { sku: 's1' }, quantity: 2 }],
});

const order = OrderSchema.parse({
  identifier: { key: 'order-1' },
  userId: { userId: 'u1' },
  items: [],
  price: CostBreakDownSchema.parse({}),
  orderStatus: 'AwaitingPayment',
  inventoryStatus: 'NotAllocated',
  paymentInstructions: [],
});

describe('summarizePlacedOrder', () => {
  it('uses the checkout key when no order is known', () => {
    const placed = summarizePlacedOrder({ checkout });

    expect(placed?.transactionId).toBe('checkout-1');
    expect(placed?.items.map((item) => item.variant.sku)).toEqual(['s1']);
  });

  it('prefers the resulting order key of the checkout', () => {
    expect(summarizePlacedOrder({ checkout: { ...checkout, resultingOrder: { key: 'order-9' } } })?.transactionId).toBe('order-9');
  });

  it('still reads the deprecated order', () => {
    expect(summarizePlacedOrder({ order })?.transactionId).toBe('order-1');
  });

  it('takes the lines from the checkout and the id from the order when both are given', () => {
    const placed = summarizePlacedOrder({ checkout, order });

    expect(placed?.transactionId).toBe('order-1');
    expect(placed?.items).toHaveLength(1);
  });

  it('returns nothing without a checkout or an order', () => {
    expect(summarizePlacedOrder({})).toBeUndefined();
  });

  it('validates a payload with only a checkout', () => {
    expect(AnalyticsMutationOrderPlacedSchema.safeParse({ checkout }).success).toBe(true);
  });
});
