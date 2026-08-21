import { OrderSchema, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MagentoOrderFactory, type MagentoOrderOutput } from '../factories/order/order.factory.js';

const RAW_ORDER = {
  entity_id: 42,
  increment_id: '000000042',
  customer_id: 7,
  customer_email: 'shopper@example.com',
  status: 'processing',
  state: 'processing',
  created_at: '2026-08-20T10:00:00.000Z',
  order_currency_code: 'eur',
  grand_total: 100,
  subtotal: 90,
  shipping_amount: 10,
  discount_amount: 5,
  tax_amount: 0,
  shipping_description: 'Standard delivery',
  items: [
    { item_id: 1, sku: 'SKU-1', name: 'Wine', qty_ordered: 2, price: 45, row_total: 90 },
  ],
  billing_address: {
    firstname: 'Jane',
    lastname: 'Doe',
    street: ['Main St 1', 'Apt 2'],
    city: 'Tallinn',
    postcode: '10111',
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

describe('MagentoOrderFactory', () => {
  const factory = new MagentoOrderFactory(OrderSchema);
  const context = createInitialRequestContext();

  it('maps a raw Magento order into the core Order shape plus passthrough fields', () => {
    const order = factory.parseOrder(context, RAW_ORDER) as unknown as MagentoOrderOutput;

    expect(order.identifier.key).toBe('42');
    expect(order.userId.userId).toBe('7');
    expect(order.orderStatus).toBe('ReleasedToFulfillment');
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      identifier: {key: '1'},
      variant: {sku: 'SKU-1'},
      quantity: 2,
    });
    expect(order.items[0].price.unitPrice).toEqual({value: 45, currency: 'EUR'});
    expect(order.price.grandTotal).toEqual({value: 100, currency: 'EUR'});
    expect(order.price.totalProductPrice).toEqual({value: 90, currency: 'EUR'});
    expect(order.price.totalShipping).toEqual({value: 10, currency: 'EUR'});
    expect(order.price.totalDiscount).toEqual({value: 5, currency: 'EUR'});
    expect(order.shippingAddress).toMatchObject({firstName: 'Jane', lastName: 'Doe', city: 'Tallinn'});
    expect(order.billingAddress).toMatchObject({firstName: 'Jane', lastName: 'Doe'});
    expect(order.shippingMethod).toMatchObject({name: 'Standard delivery'});
    expect(order.paymentInstructions).toHaveLength(1);
    expect(order.paymentInstructions[0]).toMatchObject({
      paymentMethod: {method: 'checkmo', name: 'checkmo', paymentProcessor: 'checkmo'},
      status: 'authorized',
    });

    // Passthrough fields not declared on the core Order type — survive the
    // loose-object schema parse unchanged.
    expect(order.orderDate).toBe('2026-08-20T10:00:00.000Z');
    expect(order.incrementId).toBe('000000042');
    expect(order.customerEmail).toBe('shopper@example.com');
    expect(order.customerPhone).toBe('5551234');
  });

  it('handles a guest order with no customer id and no shipping assignment', () => {
    const guestOrder = {
      ...RAW_ORDER,
      customer_id: undefined,
      extension_attributes: undefined,
    };

    const order = factory.parseOrder(context, guestOrder) as unknown as MagentoOrderOutput;

    expect(order.userId.userId).toBe('');
    expect(order.shippingAddress).toMatchObject({firstName: 'Jane', lastName: 'Doe'});
  });
});
