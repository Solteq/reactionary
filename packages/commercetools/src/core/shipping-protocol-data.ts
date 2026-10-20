import type { ShippingProtocolData } from '@reactionary/core';

/**
 * The cart custom field carrying the shipping instruction's protocol data,
 * following the same one-declared-JSON-field mechanism as the payment
 * protocol data (see payment-protocol-data.ts): commercetools rejects
 * undeclared custom fields, so one declared field carries arbitrary keys.
 */
export const SHIPPING_PROTOCOL_DATA_FIELD = 'shippingProtocolData';

/**
 * The cart custom field carrying the key of the brand's own store selected
 * for in-store pickup (BOPIS). Distinct from `pickupPointId`, which is
 * reserved for third-party carrier service points.
 */
export const PICKUP_STORE_FIELD = 'pickupStoreKey';

export function serializeShippingProtocolData(
  entries: ShippingProtocolData[],
): string {
  return JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.key, entry.value])));
}

export function parseShippingProtocolDataField(
  value: unknown,
): ShippingProtocolData[] | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const entries: ShippingProtocolData[] = [];
    for (const [key, entry] of Object.entries(parsed)) {
      if (typeof entry === 'string') {
        entries.push({ key, value: entry });
      } else if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
        entries.push({ key, value: entry });
      }
    }

    return entries.length > 0 ? entries : undefined;
  } catch {
    return undefined;
  }
}
