import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ShippingMethod as CTShippingMethod } from '@commercetools/platform-sdk';
import {
  CheckoutSchema,
  PaymentMethodSchema,
  ShippingMethodSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import {
  parseShippingProtocolDataField,
  serializeShippingProtocolData,
} from '../core/shipping-protocol-data.js';

/**
 * Offline tests for mapping commercetools shipping methods, focused on the
 * BOPIS (buy online, pickup in store) fulfillment type tagging driven by the
 * `bopis.shippingMethodKeys` configuration.
 */
const FIXTURES = new URL('./__fixtures__/checkout/', import.meta.url);

function readShippingMethod(name: string): CTShippingMethod {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

describe('Commercetools checkout factory fulfillment type tagging', () => {
  const context = createInitialRequestContext();

  const factoryWithBopis = new CommercetoolsCheckoutFactory(
    CheckoutSchema,
    ShippingMethodSchema,
    PaymentMethodSchema,
    { bopisShippingMethodKeys: ['store-pickup', 'another-pickup'] },
  );

  it('tags a shipping method listed in bopis.shippingMethodKeys as pickup', () => {
    const method = factoryWithBopis.parseShippingMethod(
      context,
      readShippingMethod('shipping-method-store-pickup.json'),
    );

    expect(method.fulfillmentType).toBe('pickup');
  });

  it('tags a shipping method not listed in bopis.shippingMethodKeys as delivery', () => {
    const method = factoryWithBopis.parseShippingMethod(
      context,
      readShippingMethod('shipping-method-standard.json'),
    );

    expect(method.fulfillmentType).toBe('delivery');
    expect(method.price).toEqual({ value: 4.95, currency: 'EUR' });
  });

  it('tags everything as delivery when no bopis configuration is given', () => {
    const factory = new CommercetoolsCheckoutFactory(
      CheckoutSchema,
      ShippingMethodSchema,
      PaymentMethodSchema,
    );

    const method = factory.parseShippingMethod(
      context,
      readShippingMethod('shipping-method-store-pickup.json'),
    );

    expect(method.fulfillmentType).toBe('delivery');
  });
});

describe('Commercetools shipping protocol data serialization', () => {
  it('round-trips string and object values through the custom field format', () => {
    const entries = [
      { key: 'pickupSlot', value: 'monday-am' },
      { key: 'window', value: { from: '10:00', to: '12:00' } },
    ];

    const parsed = parseShippingProtocolDataField(serializeShippingProtocolData(entries));

    expect(parsed).toEqual(entries);
  });

  it('returns undefined for an empty, invalid or non-string field', () => {
    expect(parseShippingProtocolDataField(undefined)).toBeUndefined();
    expect(parseShippingProtocolDataField('')).toBeUndefined();
    expect(parseShippingProtocolDataField('not json')).toBeUndefined();
    expect(parseShippingProtocolDataField('[1,2,3]')).toBeUndefined();
    expect(parseShippingProtocolDataField(42)).toBeUndefined();
  });
});
