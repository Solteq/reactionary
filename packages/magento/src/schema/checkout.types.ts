import type { MagentoShippingMethod } from './magento.types.js';

/**
 * A shipping rate as the checkout capability hands it to the factory. Magento
 * prices rates in the quote currency but does not say which, so the
 * capability adds the quote's currency code.
 */
export interface MagentoShippingMethodData extends MagentoShippingMethod {
  /** Synthetic: the currency of the quote the rate was estimated for. */
  quote_currency_code?: string;
  extension_attributes?: Record<string, unknown>;
}
