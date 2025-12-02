import type { StoreCart } from '@medusajs/types';
import type { CostBreakDown, Currency } from '@reactionary/core';
import createDebug from 'debug';

const debug = createDebug('reactionary:medusa:helpers');

/**
 * Parses cost breakdown from Medusa StoreCart
 */
export function parseMedusaCostBreakdown(remote: StoreCart): CostBreakDown {
  const grandTotal = remote.total || 0;
  const shippingTotal = remote.shipping_total || 0;
  const taxTotal = remote.tax_total || 0;
  const discountTotal = remote.discount_total || 0;
  const subtotal = remote.subtotal || 0;
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
      value: subtotal,
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
 * Handles provider errors with consistent formatting
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
