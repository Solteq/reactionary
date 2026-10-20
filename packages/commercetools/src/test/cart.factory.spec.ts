import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Cart as CTCart } from '@commercetools/platform-sdk';
import {
  CartPaginatedSearchResultSchema,
  CartSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import { CommercetoolsCartIdentifierSchema } from '../schema/commercetools.schema.js';

/**
 * Offline tests for mapping commercetools cart discounts to applied promotions.
 * The fixture is a cart holding one discount code (SAVE10, triggering the
 * CartDiscount cd-from-code) plus two automatically applied CartDiscounts:
 * one on a line item (cd-auto-line) and one on the order total (cd-auto-total).
 */
const FIXTURES = new URL('./__fixtures__/cart/', import.meta.url);

function readCart(name: string): CTCart {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

describe('Commercetools cart promotion mapping', () => {
  const factory = new CommercetoolsCartFactory(
    CartSchema,
    CommercetoolsCartIdentifierSchema,
    CartPaginatedSearchResultSchema,
  );

  const cart = factory.parseCart(
    createInitialRequestContext(),
    readCart('cart-with-code-and-automatic-discounts.json'),
  );

  it('maps the discount code with the amount of the CartDiscounts it triggers', () => {
    const codePromotion = cart.appliedPromotions.find((promo) => promo.code === 'SAVE10');

    expect(codePromotion).toMatchObject({
      code: 'SAVE10',
      isCouponCode: true,
      name: 'Save 10',
      description: '10 percent off with code',
      amount: { value: 3, currency: 'EUR' },
    });
  });

  it('includes automatically applied line item discounts as non-coupon promotions', () => {
    const autoLinePromotion = cart.appliedPromotions.find((promo) => promo.name === 'Autumn sale');

    expect(autoLinePromotion).toMatchObject({
      code: '',
      isCouponCode: false,
      description: '10% off power tools',
      amount: { value: 5, currency: 'EUR' },
    });
  });

  it('includes automatically applied order total discounts as non-coupon promotions', () => {
    const autoTotalPromotion = cart.appliedPromotions.find(
      (promo) => promo.name === 'Order total promotion',
    );

    expect(autoTotalPromotion).toMatchObject({
      code: '',
      isCouponCode: false,
      description: '1 EUR off every order',
      amount: { value: 1, currency: 'EUR' },
    });
  });

  it('does not duplicate CartDiscounts claimed by a discount code', () => {
    expect(cart.appliedPromotions).toHaveLength(3);
  });
});
