import type { MagentoClient } from './client.js';
import type {
  MagentoInventorySource,
  MagentoInventorySourceItemSearchResult,
  MagentoLegacyStockItem,
  MagentoStockStatusResponse,
} from '../schema/inventory.types.js';

/**
 * Catalog-scope inventory reads (integration token, GET only). The SKU and
 * source code are always URI-encoded path segments or query values.
 */

/** The MSI source items of `sku` at `sourceCode`. */
export function getSourceItems(
  magentoApi: MagentoClient,
  sku: string,
  sourceCode: string,
): Promise<MagentoInventorySourceItemSearchResult> {
  const params = new URLSearchParams();
  params.set('searchCriteria[filterGroups][0][filters][0][field]', 'sku');
  params.set('searchCriteria[filterGroups][0][filters][0][value]', sku);
  params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
  params.set('searchCriteria[filterGroups][1][filters][0][field]', 'source_code');
  params.set('searchCriteria[filterGroups][1][filters][0][value]', sourceCode);
  params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');
  return magentoApi.catalogRequest<MagentoInventorySourceItemSearchResult>(
    `/V1/inventory/source-items?${params.toString()}`,
  );
}

/** An MSI source. Throws a 404 `MagentoApiError` when it does not exist. */
export function getInventorySource(
  magentoApi: MagentoClient,
  sourceCode: string,
): Promise<MagentoInventorySource> {
  return magentoApi.catalogRequest<MagentoInventorySource>(
    `/V1/inventory/sources/${encodeURIComponent(sourceCode)}`,
  );
}

/** The legacy stock status of `sku`, including its stock item. */
export function getStockStatus(
  magentoApi: MagentoClient,
  sku: string,
): Promise<MagentoStockStatusResponse> {
  return magentoApi.catalogRequest<MagentoStockStatusResponse>(
    `/V1/stockStatuses/${encodeURIComponent(sku)}`,
  );
}

/** The legacy stock item of `sku`, which carries the backorder setting. */
export function getStockItem(
  magentoApi: MagentoClient,
  sku: string,
): Promise<MagentoLegacyStockItem> {
  return magentoApi.catalogRequest<MagentoLegacyStockItem>(
    `/V1/stockItems/${encodeURIComponent(sku)}`,
  );
}
