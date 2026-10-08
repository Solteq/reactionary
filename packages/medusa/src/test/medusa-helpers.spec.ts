import type { StoreCalculatedPrice } from '@medusajs/types';
import { describe, expect, it } from 'vitest';
import { hasUsableShippingPrice, parseMedusaCostBreakdown, type MedusaCostBreakdownSource } from '../utils/medusa-helpers.js';

describe('parseMedusaCostBreakdown', () => {
  it('derives totalProductPrice from item_subtotal, not subtotal (which also includes shipping)', () => {
    const remote: MedusaCostBreakdownSource = {
      item_subtotal: 100,
      shipping_total: 10,
      // Medusa's subtotal = item_subtotal + shipping_subtotal, so this is 110,
      // not 100 - using it directly would double-count shipping.
      subtotal: 110,
      tax_total: 0,
      discount_total: 0,
      total: 110,
      currency_code: 'usd',
    };

    const result = parseMedusaCostBreakdown(remote);

    expect(result.totalProductPrice).toEqual({ value: 100, currency: 'USD' });
    expect(result.totalShipping).toEqual({ value: 10, currency: 'USD' });
    expect(result.grandTotal).toEqual({ value: 110, currency: 'USD' });
  });
});

describe('hasUsableShippingPrice (reactionary-cnq.8)', () => {
  const basePrice: StoreCalculatedPrice = {
    id: 'price_1',
    calculated_amount: null,
    original_amount: null,
    original_amount_with_tax: null,
    original_amount_without_tax: null,
    currency_code: 'usd',
  };

  it('is true for a free shipping option priced at 0', () => {
    expect(hasUsableShippingPrice({ ...basePrice, calculated_amount: 0, original_amount: 0 })).toBe(true);
  });

  it('is true when only calculated_amount is set', () => {
    expect(hasUsableShippingPrice({ ...basePrice, calculated_amount: 10 })).toBe(true);
  });

  it('is true when only original_amount is set', () => {
    expect(hasUsableShippingPrice({ ...basePrice, original_amount: 10 })).toBe(true);
  });

  it('is false when both amounts are null', () => {
    expect(hasUsableShippingPrice(basePrice)).toBe(false);
  });

  it('is false when there is no calculated price at all', () => {
    expect(hasUsableShippingPrice(null)).toBe(false);
    expect(hasUsableShippingPrice(undefined)).toBe(false);
  });
});
