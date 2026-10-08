import type { StoreCalculatedPrice } from '@medusajs/types';
import { CheckoutSchema, createInitialRequestContext, NoOpCache, PaymentMethodSchema, ShippingMethodSchema } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaAPI } from '../core/client.js';
import { MedusaCheckoutCapability } from '../capabilities/checkout.capability.js';
import { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { getMedusaTestConfiguration } from './test-utils.js';

/**
 * hasUsableShippingPrice is a protected extension point (so a project can
 * override which shipping options count as "usable"); expose it to test the
 * default implementation directly, same as overriding it would.
 */
class TestableMedusaCheckoutCapability extends MedusaCheckoutCapability {
  public exposeHasUsableShippingPrice(calculatedPrice: StoreCalculatedPrice | null | undefined): boolean {
    return this.hasUsableShippingPrice(calculatedPrice);
  }
}

describe('MedusaCheckoutCapability.hasUsableShippingPrice (reactionary-cnq.8)', () => {
  const basePrice: StoreCalculatedPrice = {
    id: 'price_1',
    calculated_amount: null,
    original_amount: null,
    original_amount_with_tax: null,
    original_amount_without_tax: null,
    currency_code: 'usd',
  };

  function createCapability(): TestableMedusaCheckoutCapability {
    const config = getMedusaTestConfiguration();
    const reqCtx = createInitialRequestContext();
    return new TestableMedusaCheckoutCapability(
      config,
      new NoOpCache(),
      reqCtx,
      new MedusaAPI(config, reqCtx),
      new MedusaCheckoutFactory(CheckoutSchema, ShippingMethodSchema, PaymentMethodSchema),
    );
  }

  it('is true for a free shipping option priced at 0', () => {
    const capability = createCapability();
    expect(capability.exposeHasUsableShippingPrice({ ...basePrice, calculated_amount: 0, original_amount: 0 })).toBe(true);
  });

  it('is true when only calculated_amount is set', () => {
    const capability = createCapability();
    expect(capability.exposeHasUsableShippingPrice({ ...basePrice, calculated_amount: 10 })).toBe(true);
  });

  it('is true when only original_amount is set', () => {
    const capability = createCapability();
    expect(capability.exposeHasUsableShippingPrice({ ...basePrice, original_amount: 10 })).toBe(true);
  });

  it('is false when both amounts are null', () => {
    const capability = createCapability();
    expect(capability.exposeHasUsableShippingPrice(basePrice)).toBe(false);
  });

  it('is false when there is no calculated price at all', () => {
    const capability = createCapability();
    expect(capability.exposeHasUsableShippingPrice(null)).toBe(false);
    expect(capability.exposeHasUsableShippingPrice(undefined)).toBe(false);
  });
});
