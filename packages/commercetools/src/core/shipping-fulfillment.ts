import type { ShippingMethod as CTShippingMethod } from '@commercetools/platform-sdk';
import type { ShippingFulfillmentType } from '@reactionary/core';

/**
 * Resolves the core fulfillment type of a commercetools shipping method from
 * the `bopis.shippingMethodKeys` configuration: shipping methods whose key is
 * listed are in-store pickup (BOPIS), everything else is a delivery.
 */
export function resolveShippingFulfillmentType(
  shippingMethod: CTShippingMethod,
  bopisShippingMethodKeys: string[] | undefined,
): ShippingFulfillmentType {
  return shippingMethod.key && (bopisShippingMethodKeys || []).includes(shippingMethod.key)
    ? 'pickup'
    : 'delivery';
}
