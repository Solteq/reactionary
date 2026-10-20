import { OrderSchema, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import {
  MagentoOrderFactory,
  type MagentoOrderDetail,
  type MagentoOrderOutput,
} from '../factories/order/order.factory.js';
import {
  magentoOrderStatesFor,
  mapMagentoOrderStatus,
  parseMagentoDate,
} from '../factories/order/order-mapping.js';

const RAW_ORDER: MagentoOrderDetail = {
  entity_id: 42,
  increment_id: '000000042',
  quote_id: 314,
  customer_id: 7,
  customer_is_guest: 0,
  customer_email: 'shopper@example.com',
  status: 'processing',
  state: 'processing',
  created_at: '2026-08-20 10:00:00',
  order_currency_code: 'eur',
  grand_total: 100,
  subtotal: 90,
  shipping_amount: 10,
  discount_amount: -5,
  tax_amount: 0,
  shipping_description: 'Standard delivery',
  items: [
    {
      item_id: 1,
      sku: 'SKU-1',
      name: 'Wine',
      product_type: 'simple',
      qty_ordered: 2,
      qty_shipped: 0,
      price: 45,
      row_total: 90,
      discount_amount: 5,
    },
  ],
  billing_address: {
    firstname: 'Bill',
    lastname: 'Payer',
    street: ['Billing St 1', 'Apt 2'],
    city: 'Tartu',
    postcode: '50090',
    country_id: 'EE',
    telephone: '5551234',
    email: 'shopper@example.com',
  },
  payment: { method: 'checkmo', amount_ordered: 100 },
  extension_attributes: {
    shipping_assignments: [
      {
        shipping: {
          method: 'flatrate_flatrate',
          address: {
            firstname: 'Jane',
            lastname: 'Doe',
            street: ['Main St 1'],
            city: 'Tallinn',
            postcode: '10111',
            country_id: 'EE',
            telephone: '5551234',
          },
        },
      },
    ],
  },
};

/** The factory output carries the Magento passthrough fields. */
function isMagentoOrderOutput(value: object): value is MagentoOrderOutput {
  return 'orderDate' in value;
}

function parse(data: unknown): MagentoOrderOutput {
  const order = new MagentoOrderFactory(OrderSchema).parseOrder(createInitialRequestContext(), data);
  if (!isMagentoOrderOutput(order)) {
    throw new Error('expected the Magento order output');
  }
  return order;
}

describe('MagentoOrderFactory', () => {
  it('maps a raw Magento order into the core Order shape plus passthrough fields', () => {
    const order = parse(RAW_ORDER);

    expect(order.identifier.key).toBe('42');
    expect(order.userId.userId).toBe('7');
    expect(order.name).toBe('000000042');
    expect(order.cartReference).toEqual({ key: '314' });
    expect(order.orderStatus).toBe('ReleasedToFulfillment');
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      identifier: { key: '1' },
      variant: { sku: 'SKU-1' },
      quantity: 2,
      inventoryStatus: 'NotAllocated',
    });
    expect(order.items[0].price).toEqual({
      unitPrice: { value: 45, currency: 'EUR' },
      totalPrice: { value: 90, currency: 'EUR' },
      unitDiscount: { value: 2.5, currency: 'EUR' },
      totalDiscount: { value: 5, currency: 'EUR' },
    });
    expect(order.price.grandTotal).toEqual({ value: 100, currency: 'EUR' });
    expect(order.price.totalProductPrice).toEqual({ value: 90, currency: 'EUR' });
    expect(order.price.totalShipping).toEqual({ value: 10, currency: 'EUR' });
    expect(order.price.totalDiscount).toEqual({ value: 5, currency: 'EUR' });
    expect(order.shippingAddress).toMatchObject({ firstName: 'Jane', lastName: 'Doe', city: 'Tallinn' });
    expect(order.billingAddress).toMatchObject({ firstName: 'Bill', lastName: 'Payer', city: 'Tartu' });
    expect(order.shippingMethod).toMatchObject({ name: 'Standard delivery' });
    expect(order.paymentInstructions).toHaveLength(1);
    expect(order.paymentInstructions[0]).toMatchObject({
      paymentMethod: { method: 'checkmo', name: 'checkmo', paymentProcessor: 'checkmo' },
      status: 'authorized',
    });
    expect(order.company).toBeUndefined();

    // Passthrough fields not declared on the core Order type.
    expect(order.orderDate).toBe('2026-08-20T10:00:00.000Z');
    expect(order.incrementId).toBe('000000042');
    expect(order.customerEmail).toBe('shopper@example.com');
    expect(order.customerPhone).toBe('5551234');
  });

  it('does not fall back to the billing address when there is no shipment assignment', () => {
    const order = parse({
      ...RAW_ORDER,
      customer_id: undefined,
      customer_is_guest: 1,
      extension_attributes: undefined,
    });

    expect(order.userId.userId).toBe('');
    expect(order.shippingAddress).toBeUndefined();
    expect(order.billingAddress).toMatchObject({ firstName: 'Bill' });
    // A guest cart is keyed by a masked id the order does not carry.
    expect(order.cartReference).toBeUndefined();
  });

  it('reports a configurable product once, as its selected variant', () => {
    const order = parse({
      ...RAW_ORDER,
      items: [
        {
          item_id: 10,
          sku: 'TEE-RED-M',
          product_type: 'configurable',
          qty_ordered: 1,
          qty_shipped: 1,
          price: 30,
          row_total: 30,
          discount_amount: 3,
        },
        {
          item_id: 11,
          sku: 'TEE-RED-M',
          product_type: 'simple',
          parent_item_id: 10,
          qty_ordered: 1,
          qty_shipped: 1,
          price: 0,
          row_total: 0,
        },
      ],
    });

    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      identifier: { key: '10' },
      variant: { sku: 'TEE-RED-M' },
      quantity: 1,
      inventoryStatus: 'Allocated',
    });
    expect(order.items[0].price.unitPrice.value).toBe(30);
    expect(order.items[0].price.totalDiscount.value).toBe(3);
    expect(order.inventoryStatus).toBe('Allocated');
  });

  it('derives inventory status from the shipped quantities', () => {
    const order = parse({
      ...RAW_ORDER,
      state: 'complete',
      items: [
        { item_id: 1, sku: 'A', qty_ordered: 2, qty_shipped: 2 },
        { item_id: 2, sku: 'B', qty_ordered: 3, qty_shipped: 1 },
        { item_id: 3, sku: 'C', qty_ordered: 1, qty_canceled: 1, qty_shipped: 0 },
      ],
    });

    expect(order.items.map((item) => item.inventoryStatus)).toEqual([
      'Allocated',
      'NotAllocated',
      'NotAllocated',
    ]);
    expect(order.inventoryStatus).toBe('NotAllocated');
  });

  it('derives the payment status from the payment amounts', () => {
    const captured = parse({
      ...RAW_ORDER,
      payment: { method: 'checkmo', amount_ordered: 100, amount_paid: 100 },
    });
    const refunded = parse({
      ...RAW_ORDER,
      state: 'closed',
      status: 'closed',
      payment: { method: 'checkmo', amount_ordered: 100, amount_paid: 100, amount_refunded: 100 },
    });

    expect(captured.paymentInstructions[0].status).toBe('captured');
    expect(refunded.paymentInstructions[0].status).toBe('refunded');
    expect(refunded.orderStatus).toBe('Cancelled');
  });

  it('identifies the B2B company by uid when its VAT id is unknown', () => {
    const order = parse({
      ...RAW_ORDER,
      extension_attributes: { company_order_attributes: { company_id: 3, company_name: 'ACME' } },
    });

    expect(order.company?.taxIdentifier).toBe('Mw==');
  });

  it('keeps a missing creation date empty instead of inventing one', () => {
    const order = parse({ ...RAW_ORDER, created_at: undefined });

    expect(order.orderDate).toBe('');
  });

  it('falls back to the request currency for an unknown currency code', () => {
    const order = parse({ ...RAW_ORDER, order_currency_code: 'XYZ1' });

    expect(order.price.grandTotal.currency).toBe(createInitialRequestContext().languageContext.currencyCode);
  });

  it('accepts nulls and numeric strings as Magento sends them', () => {
    const order = parse({
      ...RAW_ORDER,
      entity_id: '42',
      grand_total: '100.0000',
      customer_note: null,
      billing_address: { ...RAW_ORDER.billing_address, region: null },
    });

    expect(order.identifier.key).toBe('42');
    expect(order.price.grandTotal.value).toBe(100);
  });

  it('rejects a payload that is not a Magento order', () => {
    expect(() => parse({ increment_id: '1' })).toThrow();
  });
});

describe('mapMagentoOrderStatus', () => {
  it.each([
    ['pending', 'new', 'AwaitingPayment'],
    ['pending_payment', 'pending_payment', 'AwaitingPayment'],
    ['payment_review', 'payment_review', 'AwaitingPayment'],
    ['fraud', 'payment_review', 'AwaitingPayment'],
    ['holded', 'holded', 'AwaitingPayment'],
    ['processing', 'processing', 'ReleasedToFulfillment'],
    ['complete', 'complete', 'Shipped'],
    ['closed', 'closed', 'Cancelled'],
    ['canceled', 'canceled', 'Cancelled'],
    // A custom status follows its state.
    ['awaiting_pickup', 'processing', 'ReleasedToFulfillment'],
  ] as const)('maps status %s / state %s to %s', (status, state, expected) => {
    expect(mapMagentoOrderStatus(status, state)).toBe(expected);
  });

  it('falls back to the status code without a state', () => {
    expect(mapMagentoOrderStatus('complete')).toBe('Shipped');
    expect(mapMagentoOrderStatus('pending')).toBe('AwaitingPayment');
    expect(mapMagentoOrderStatus('closed')).toBe('Cancelled');
  });

  it('reports an unrecognised order as awaiting payment', () => {
    expect(mapMagentoOrderStatus('something_custom', 'unknown_state')).toBe('AwaitingPayment');
    expect(mapMagentoOrderStatus()).toBe('AwaitingPayment');
  });

  it('inverts to the states searched for each core status', () => {
    expect(magentoOrderStatesFor(['AwaitingPayment'])).toEqual([
      'new',
      'pending_payment',
      'payment_review',
      'holded',
    ]);
    expect(magentoOrderStatesFor(['Cancelled'])).toEqual(['closed', 'canceled']);
  });
});

describe('parseMagentoDate', () => {
  it('reads Magento timestamps as UTC', () => {
    expect(parseMagentoDate('2026-08-20 23:30:00')).toBe('2026-08-20T23:30:00.000Z');
  });

  it('keeps ISO input and leaves empty input empty', () => {
    expect(parseMagentoDate('2026-08-20T10:00:00Z')).toBe('2026-08-20T10:00:00.000Z');
    expect(parseMagentoDate(undefined)).toBe('');
  });
});
