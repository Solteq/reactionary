import { describe, expect, it } from 'vitest';
import { parseMedusaCostBreakdown, type MedusaCostBreakdownSource } from '../utils/medusa-helpers.js';

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
