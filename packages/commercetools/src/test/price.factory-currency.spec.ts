import { describe, expect, it } from 'vitest';
import type { ProductVariant } from '@commercetools/platform-sdk';
import { createInitialRequestContext, PriceSchema } from '@reactionary/core';
import { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';

/** commercetools centAmount is in the minor units of the currency; reactionary prices are decimal and ready for Intl.NumberFormat. */
function variantWithPrice(centAmount: number, currencyCode: string, discountedCentAmount?: number): ProductVariant {
  return {
    id: 1,
    sku: 'sku-1',
    price: {
      id: 'p1',
      value: { type: 'centPrecision', centAmount, currencyCode, fractionDigits: 2 },
      ...(discountedCentAmount !== undefined
        ? {
            discounted: {
              value: { type: 'centPrecision', centAmount: discountedCentAmount, currencyCode, fractionDigits: 2 },
              discount: { typeId: 'product-discount', id: 'd1' },
            },
          }
        : {}),
    },
  } as unknown as ProductVariant;
}

describe('Commercetools price factory currency exponent', () => {
  const context = createInitialRequestContext();
  const factory = new CommercetoolsPriceFactory(PriceSchema);

  it.each([
    [1999, 'EUR', 19.99],
    [1999, 'JPY', 1999],
    [1999, 'KWD', 1.999],
  ])('maps %i %s to %d', (centAmount, currency, expected) => {
    const price = factory.parsePrice(context, variantWithPrice(centAmount, currency));
    expect(price.unitPrice).toEqual({ value: expected, currency });
  });

  it('maps the discounted price with the exponent of its currency', () => {
    const price = factory.parsePrice(context, variantWithPrice(2000, 'JPY', 1500), { includeDiscounts: true });
    expect(price.unitPrice.value).toBe(1500);
  });
});
