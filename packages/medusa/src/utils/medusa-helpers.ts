import type { StoreCalculatedPrice, StoreCart } from '@medusajs/types';
import type { CostBreakDown, Currency } from '@reactionary/core';
import createDebug from 'debug';

const debug = createDebug('reactionary:medusa:helpers');

/**
 * The subset of StoreCart/StoreOrder fields parseMedusaCostBreakdown reads.
 * Narrowed (rather than StoreCart | StoreOrder) so tests can build a minimal,
 * fully-typed fixture without casting.
 */
export type MedusaCostBreakdownSource = Pick<
  StoreCart,
  'total' | 'subtotal' | 'item_subtotal' | 'shipping_total' | 'tax_total' | 'discount_total' | 'currency_code'
>;

/**
 * Parses cost breakdown from Medusa StoreCart
 */
export function parseMedusaCostBreakdown(remote: MedusaCostBreakdownSource): CostBreakDown {
  const grandTotal = remote.total || 0;
  const shippingTotal = remote.shipping_total || 0;
  const taxTotal = remote.tax_total || 0;
  const discountTotal = remote.discount_total || 0;
  // `subtotal` is item_subtotal + shipping_subtotal in Medusa; use item_subtotal
  // alone so totalProductPrice doesn't double-count shipping (already reported
  // separately as totalShipping below).
  const itemSubtotal = remote.item_subtotal || 0;
  const currency = (remote.currency_code || 'EUR').toUpperCase() as Currency;

  return {
    totalTax: {
      value: taxTotal,
      currency,
    },
    totalDiscount: {
      value: discountTotal,
      currency,
    },
    totalSurcharge: {
      value: 0,
      currency,
    },
    totalShipping: {
      value: shippingTotal,
      currency,
    },
    totalProductPrice: {
      value: itemSubtotal,
      currency,
    },
    grandTotal: {
      value: grandTotal,
      currency,
    },
  };
}

/**
 * Parses item price structure from Medusa line item
 */
export function parseMedusaItemPrice(
  remoteItem: { unit_price?: number; quantity: number; discount_total?: number },
  currency: Currency
) {
  const unitPrice = remoteItem.unit_price || 0;
  const totalPrice = unitPrice * remoteItem.quantity || 0;
  const discountTotal = remoteItem.discount_total || 0;

  return {
    unitPrice: {
      value: unitPrice,
      currency,
    },
    unitDiscount: {
      value: discountTotal / remoteItem.quantity,
      currency,
    },
    totalPrice: {
      value: totalPrice,
      currency,
    },
    totalDiscount: {
      value: discountTotal,
      currency,
    },
  };
}

/**
 * Whether a Medusa shipping option's calculated price is usable, i.e. has an
 * actual amount (which may be `0` for valid free shipping) rather than no
 * price data at all. `calculated_amount`/`original_amount` are `number | null`;
 * checking them with a plain falsy check would incorrectly treat a `0` amount
 * (free shipping) the same as a missing price and drop the option.
 */
export function hasUsableShippingPrice(calculatedPrice: StoreCalculatedPrice | null | undefined): boolean {
  if (!calculatedPrice) {
    return false;
  }
  return calculatedPrice.calculated_amount != null || calculatedPrice.original_amount != null;
}

/**
 * Handles capability implementation errors with consistent formatting
 */
export function handleProviderError(action: string, error: unknown): never {
  if (debug.enabled) {
    debug(`Failed to ${action}:`, error);
  }
  throw new Error(
    `Failed to ${action}: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
  );
}


export  function safeBoolConvert(val?: unknown): boolean {
    if (!val) {
      return false;
    }
    return String(val).toLowerCase() === 'true';
  }

export function safeStringConvert(val?: unknown, defaultValue?: string): string | undefined {
    if (!val) {
      return defaultValue;
    }
    return String(val);
  }
