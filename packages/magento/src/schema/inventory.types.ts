import type { MagentoSourceItem } from './magento.types.js';

/**
 * The legacy (single-stock) stock item, as embedded in `/V1/stockStatuses/{sku}`
 * and returned by `/V1/stockItems/{sku}`. Only the fields the inventory
 * capability reads are listed.
 */
export interface MagentoLegacyStockItem {
  qty?: number | null;
  is_in_stock?: boolean;
  /**
   * The effective backorder mode: 0 = no backorders, 1 = allow qty below 0,
   * 2 = allow qty below 0 and notify the customer. Magento resolves
   * `use_config_backorders` before returning it.
   */
  backorders?: number;
  use_config_backorders?: boolean;
  /** False when the product's stock is not managed (always available). */
  manage_stock?: boolean;
}

/** `/V1/stockStatuses/{sku}`. */
export interface MagentoStockStatusResponse {
  product_id?: number;
  stock_id?: number;
  qty?: number | null;
  /** 1 = in stock, 0 = out of stock. */
  stock_status?: number;
  stock_item?: MagentoLegacyStockItem;
}

/** `/V1/inventory/sources/{sourceCode}` (MSI). */
export interface MagentoInventorySource {
  source_code: string;
  name?: string;
  enabled?: boolean;
}

/** `/V1/inventory/source-items?searchCriteria…` (MSI). */
export interface MagentoInventorySourceItemSearchResult {
  items?: MagentoSourceItem[];
  total_count?: number;
}
