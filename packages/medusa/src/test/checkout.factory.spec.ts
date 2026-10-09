import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoreCart } from '@medusajs/types';
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
