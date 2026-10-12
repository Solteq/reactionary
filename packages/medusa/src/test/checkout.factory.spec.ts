import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoreCart, StoreCartShippingOptionWithServiceZone } from '@medusajs/types';
import {
  CheckoutSchema,
  createInitialRequestContext,
  PaymentMethodSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';

/**
 * Offline tests for mapping a Medusa cart to a checkout, focused on the
 * shipping method's pickup point / instructions and their metadata fallback.
 */
const FIXTURES = new URL('./__fixtures__/checkout/', import.meta.url);

function readCart(name: string): StoreCart {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

describe('Medusa checkout factory shipping instruction mapping', () => {
  const factory = new MedusaCheckoutFactory(
    CheckoutSchema,
    ShippingMethodSchema,
    PaymentMethodSchema,
  );
  const context = createInitialRequestContext();

  it('leaves pickup point and instructions empty when neither shipping method data nor metadata has them', () => {
    const checkout = factory.parseCheckout(context, readCart('cart-with-shipping-method.json'));

    expect(checkout.shippingInstruction).toMatchObject({
      pickupPoint: '',
      instructions: '',
      consentForUnattendedDelivery: false,
    });
    expect(checkout.readyForFinalization).toBe(false);
  });

  it('uses pickup point and instructions from the shipping method data when present', () => {
    const cart = readCart('cart-with-shipping-method.json');
    cart.shipping_methods![0].data = {
      pickup_point: 'shop-123',
      instructions: 'ring twice',
      consent_for_unattended_delivery: 'true',
    };

    const checkout = factory.parseCheckout(context, cart);

    expect(checkout.shippingInstruction).toMatchObject({
      pickupPoint: 'shop-123',
      instructions: 'ring twice',
      consentForUnattendedDelivery: true,
    });
  });

  it('falls back to cart metadata when the shipping method data has no values', () => {
    const cart = readCart('cart-with-shipping-method.json');
    cart.metadata = {
      pickup_point: 'locker-7',
      instructions: 'leave at door',
      consent_for_unattended_delivery: 'true',
    };

    const checkout = factory.parseCheckout(context, cart);

    expect(checkout.shippingInstruction).toMatchObject({
      pickupPoint: 'locker-7',
      instructions: 'leave at door',
      consentForUnattendedDelivery: true,
    });
  });

  it('never renders missing values as the string "undefined"', () => {
    const checkout = factory.parseCheckout(context, readCart('cart-with-shipping-method.json'));

    expect(checkout.shippingInstruction?.pickupPoint).not.toContain('undefined');
    expect(checkout.shippingInstruction?.instructions).not.toContain('undefined');
  });
});

describe('Medusa checkout factory shipping method fulfillment type mapping', () => {
  const factory = new MedusaCheckoutFactory(
    CheckoutSchema,
    ShippingMethodSchema,
    PaymentMethodSchema,
  );
  const context = createInitialRequestContext();

  function readShippingOption(name: string): StoreCartShippingOptionWithServiceZone {
    return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
  }

  it('tags a shipping option of a pickup fulfillment set as pickup', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-pickup.json'),
    );

    expect(method.fulfillmentType).toBe('pickup');
  });

  it('tags a shipping option of a shipping fulfillment set as delivery', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-delivery.json'),
    );

    expect(method.fulfillmentType).toBe('delivery');
  });

  it('falls back to delivery when the service zone relation was not requested', () => {
    const option = readShippingOption('shipping-option-delivery.json');
    delete (option as Partial<StoreCartShippingOptionWithServiceZone>).service_zone;

    const method = factory.parseShippingMethod(context, option);

    expect(method.fulfillmentType).toBe('delivery');
  });
});

describe('Medusa checkout factory BOPIS store and protocol data mapping', () => {
  const factory = new MedusaCheckoutFactory(
    CheckoutSchema,
    ShippingMethodSchema,
    PaymentMethodSchema,
  );
  const context = createInitialRequestContext();

  it('maps the pickup store and protocol data from the cart metadata', () => {
    const cart = readCart('cart-with-shipping-method.json');
    cart.metadata = {
      pickup_store: 'sloc_copenhagen',
      shipping_protocol_data: JSON.stringify({
        pickupSlot: 'monday-am',
        window: { from: '10:00', to: '12:00' },
      }),
    };

    const checkout = factory.parseCheckout(context, cart);

    expect(checkout.shippingInstruction?.store).toEqual({ key: 'sloc_copenhagen' });
    expect(checkout.shippingInstruction?.protocolData).toEqual([
      { key: 'pickupSlot', value: 'monday-am' },
      { key: 'window', value: { from: '10:00', to: '12:00' } },
    ]);
  });

  it('leaves store and protocol data absent when the cart never set them', () => {
    const checkout = factory.parseCheckout(context, readCart('cart-with-shipping-method.json'));

    expect(checkout.shippingInstruction?.store).toBeUndefined();
    expect(checkout.shippingInstruction?.protocolData).toBeUndefined();
  });

  it('prefers the shipping method data over the metadata backup', () => {
    const cart = readCart('cart-with-shipping-method.json');
    cart.metadata = { pickup_store: 'sloc_backup' };
    cart.shipping_methods![0].data = { pickup_store: 'sloc_copenhagen' };

    const checkout = factory.parseCheckout(context, cart);

    expect(checkout.shippingInstruction?.store).toEqual({ key: 'sloc_copenhagen' });
  });
});
