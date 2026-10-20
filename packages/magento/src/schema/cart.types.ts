import type { CompanyIdentifier } from '@reactionary/core';
import type { MagentoCart, MagentoTotalSegment } from './magento.types.js';

/**
 * A quote as the cart capability hands it to the factory: the cart merged
 * with its totals (`GET .../totals`), plus the reactionary-only data Magento
 * has no field for, which the capability keeps in the request session.
 */
export interface MagentoCartData extends MagentoCart {
  /** The totals segments (`subtotal`, `discount`, `tax`, fee modules, ...). */
  total_segments?: MagentoTotalSegment[];
  /**
   * Synthetic: the company the cart was created for (`createCart`). Magento
   * quotes carry no company reference, so it is kept in the session.
   */
  _company?: CompanyIdentifier;
}
