import { describe, expect, it } from 'vitest';
import type { ShippingMethod as CTShippingMethod } from '@commercetools/platform-sdk';
import {
  CheckoutSchema,
  PaymentMethodSchema,
  ShippingMethodSchema,
  createInitialRequestContext,
  type Address,
  type CostBreakDown,
  type Currency,
  type PaymentInstruction,
  type ShippingInstruction,
} from '@reactionary/core';
import { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';

class TestCheckoutFactory extends CommercetoolsCheckoutFactory<
  typeof CheckoutSchema,
  typeof ShippingMethodSchema,
  typeof PaymentMethodSchema
> {
  public ready(price: CostBreakDown, payments: PaymentInstruction[]): boolean {
    // the address and shipping instruction only have to be present for the gate under test
    const address = {} as unknown as Address;
    const shipping = {} as unknown as ShippingInstruction;
    return this.isReadyForFinalization(price, payments, address, address, shipping);
  }
}

const factory = new TestCheckoutFactory(CheckoutSchema, ShippingMethodSchema, PaymentMethodSchema);

function totals(value: number, currency: Currency): CostBreakDown {
  const money = { value: 0, currency };
  return {
    totalTax: money,
    totalDiscount: money,
    totalSurcharge: money,
    totalShipping: money,
    totalProductPrice: { value, currency },
    grandTotal: { value, currency },
  };
}

function payment(value: number, currency: Currency, status = 'authorized'): PaymentInstruction {
  return { amount: { value, currency }, status } as unknown as PaymentInstruction;
}

describe('Commercetools checkout finalization gate by currency', () => {
  it.each([
    [19.99, 'EUR'],
    [1999, 'JPY'],
    [1.999, 'KWD'],
  ] as const)('passes for an authorized payment of %d %s equal to the total', (value, currency) => {
    expect(factory.ready(totals(value, currency), [payment(value, currency)])).toBe(true);
  });

  it('sums several authorized payments exactly', () => {
    expect(factory.ready(totals(0.3, 'EUR'), [payment(0.1, 'EUR'), payment(0.2, 'EUR')])).toBe(true);
  });

  it('fails when the authorized amount differs', () => {
    expect(factory.ready(totals(1999, 'JPY'), [payment(1998, 'JPY')])).toBe(false);
  });

  it('ignores payments that are not authorized', () => {
    expect(factory.ready(totals(10, 'EUR'), [payment(10, 'EUR', 'pending')])).toBe(false);
  });

  it('does not count a payment in another currency, even when the minor units add up', () => {
    // 10.00 EUR = 1000 minor units, 1000 JPY = 1000 minor units
    expect(factory.ready(totals(10, 'EUR'), [payment(1000, 'JPY')])).toBe(false);
  });
});

describe('Commercetools shipping method price', () => {
  it('has the fallback currency when no rate matches', () => {
    const context = createInitialRequestContext();
    const method = factory.parseShippingMethod(context, {
      key: 'm1',
      name: 'Method',
      zoneRates: [],
    } as unknown as CTShippingMethod);
    expect(method.price).toEqual({ value: 0, currency: context.languageContext.currencyCode });
  });

  it('converts the matching rate with the exponent of its currency', () => {
    const method = factory.parseShippingMethod(createInitialRequestContext(), {
      key: 'm1',
      name: 'Method',
      zoneRates: [
        { shippingRates: [{ isMatching: true, price: { type: 'centPrecision', centAmount: 500, currencyCode: 'JPY', fractionDigits: 0 } }] },
      ],
    } as unknown as CTShippingMethod);
    expect(method.price).toEqual({ value: 500, currency: 'JPY' });
  });
});
