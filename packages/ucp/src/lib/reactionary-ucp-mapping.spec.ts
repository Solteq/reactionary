import type { CostBreakDown } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { toUcpCostTotals, type UCPPricedItem } from './reactionary-ucp-mapping.js';

const dkk = (value: number) => ({ value, currency: 'DKK' as const });

function createItem(unitPrice: number, quantity: number, discount = 0): UCPPricedItem {
  return {
    identifier: { key: 'line-1' },
    variant: { sku: 'sku-1' },
    quantity,
    price: {
      unitPrice: dkk(unitPrice),
      unitDiscount: dkk(discount / quantity),
      totalPrice: dkk(unitPrice * quantity - discount),
      totalDiscount: dkk(discount),
    },
  };
}

function createPrice(price: Partial<CostBreakDown>): CostBreakDown {
  return {
    totalTax: dkk(0),
    totalDiscount: dkk(0),
    totalSurcharge: dkk(0),
    totalShipping: dkk(0),
    totalProductPrice: dkk(0),
    grandTotal: dkk(0),
    ...price,
  };
}

describe('toUcpCostTotals', () => {
  it('reports no additive tax entry for tax-inclusive prices', () => {
    const totals = toUcpCostTotals(
      createPrice({ totalTax: dkk(200), totalShipping: dkk(65), grandTotal: dkk(1065) }),
      [createItem(500, 2)],
    );

    expect(totals).toEqual([
      { type: 'subtotal', amount: 100000 },
      { type: 'fulfillment', amount: 6500 },
      { type: 'total', amount: 106500 },
    ]);
  });

  it('reports additive tax and line-allocated discounts so the entries sum to the total', () => {
    const totals = toUcpCostTotals(
      createPrice({ totalTax: dkk(245), totalDiscount: dkk(20), grandTotal: dkk(1225) }),
      [createItem(500, 2, 20)],
    );

    expect(totals).toEqual([
      { type: 'subtotal', amount: 100000 },
      { type: 'items_discount', amount: -2000 },
      { type: 'tax', amount: 24500 },
      { type: 'total', amount: 122500 },
    ]);
    expect(totals.filter((total) => total.type !== 'total').reduce((sum, total) => sum + total.amount, 0)).toBe(122500);
  });
});
