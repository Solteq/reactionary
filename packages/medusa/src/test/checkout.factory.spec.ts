import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoreCart, StoreCartShippingOptionWithServiceZone } from '@medusajs/types';
import {
  CheckoutSchema,
  createInitialRequestContext,
  PaymentMethodSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import {
  MedusaCheckoutFactory,
  type MedusaShippingOptionWithMetadata,
} from '../factories/checkout/checkout.factory.js';

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

  it('maps the shipping option data (the provider payload) to the shipping method protocolData', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-nshift.json'),
    );

    expect(method.protocolData).toEqual([
      { key: 'id', value: 'pan-nordic-749' },
      { key: 'name', value: 'Postnord Mypack Collect' },
      { key: 'option_id', value: 'pan-nordic-749' },
      { key: 'carrier_id', value: 'Postnord' },
      { key: 'carrier_name', value: 'PostNord' },
      { key: 'carrier_product_id', value: '749' },
      { key: 'carrier_product_name', value: 'Postnord Mypack Collect' },
    ]);
  });

  it('populates the carrier from the provider data', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-nshift.json'),
    );

    expect(method.carrier).toBe('Postnord');
  });

  it('no longer maps the shipping option metadata to protocolData', () => {
    const option: MedusaShippingOptionWithMetadata = readShippingOption('shipping-option-delivery.json');
    option.metadata = { internal_note: 'merchant annotation' };

    const method = factory.parseShippingMethod(context, option);

    expect(method.protocolData).toBeUndefined();
  });

  it('leaves protocolData and carrier absent when the shipping option has no data', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-delivery.json'),
    );

    expect(method.protocolData).toBeUndefined();
    expect(method.carrier).toBeUndefined();
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

describe('Medusa checkout factory pickup_store protocol data', () => {
  const factory = new MedusaCheckoutFactory(
    CheckoutSchema,
    ShippingMethodSchema,
    PaymentMethodSchema,
  );
  const context = createInitialRequestContext();

  function readShippingOption(name: string): MedusaShippingOptionWithMetadata {
    return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
  }

  it('emits the pickup store reference for a pickup option', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-pickup.json'),
    );

    expect(method.protocolData).toContainEqual({
      key: 'pickup_store',
      value: 'sloc_copenhagen',
    });
  });

  it('never emits a store reference for a delivery option, although it has a location', () => {
    const method = factory.parseShippingMethod(
      context,
      readShippingOption('shipping-option-delivery.json'),
    );

    expect(
      (method.protocolData ?? []).find((entry) => entry.key === 'pickup_store'),
    ).toBeUndefined();
  });

  it('lets explicit provider data win over the derived store reference', () => {
    const option = readShippingOption('shipping-option-pickup.json');
    option.data = { pickup_store: 'sloc_other' };

    const method = factory.parseShippingMethod(context, option);

    const storeEntries = (method.protocolData ?? []).filter(
      (entry) => entry.key === 'pickup_store',
    );
    expect(storeEntries).toEqual([{ key: 'pickup_store', value: 'sloc_other' }]);
  });
});
