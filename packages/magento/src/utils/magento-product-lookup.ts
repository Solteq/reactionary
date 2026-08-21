import type { MagentoClient } from '../core/client.js';
import type {
  MagentoCategory,
  MagentoProduct,
} from '../schema/magento.types.js';

function singleFilter(
  field: string,
  value: string,
  conditionType: 'eq' | 'in' = 'eq',
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('searchCriteria[filterGroups][0][filters][0][field]', field);
  params.set('searchCriteria[filterGroups][0][filters][0][value]', value);
  params.set(
    'searchCriteria[filterGroups][0][filters][0][condition_type]',
    conditionType,
  );
  return params;
}

/**
 * Reactionary addresses products by their `external_id`, while the Magento
 * catalogue endpoints key off SKU. Falls back to `entity_id` and finally to
 * treating the key as a SKU directly.
 */
export async function resolveProductSku(
  magentoApi: MagentoClient,
  key: string,
): Promise<string | null> {
  const byExternalId = singleFilter('external_id', key);
  byExternalId.set('searchCriteria[pageSize]', '1');

  try {
    const result = await magentoApi.searchProducts(byExternalId);
    const product = result.items?.[0];
    if (product?.sku) {
      return product.sku;
    }
  } catch {
    // fall through to the other resolution strategies
  }

  if (/^\d+$/.test(key)) {
    const byEntityId = singleFilter('entity_id', key);
    byEntityId.set('searchCriteria[pageSize]', '1');
    try {
      const result = await magentoApi.searchProducts(byEntityId);
      const product = result.items?.[0];
      if (product?.sku) {
        return product.sku;
      }
    } catch {
      return null;
    }
  }

  return key;
}

export async function fetchProductsBySkus(
  magentoApi: MagentoClient,
  skus: string[],
): Promise<MagentoProduct[]> {
  if (skus.length === 0) {
    return [];
  }

  const params = singleFilter('sku', skus.join(','), 'in');
  params.set('searchCriteria[pageSize]', String(skus.length));

  const result = await magentoApi.searchProducts(params);
  const found = result.items ?? [];

  // Preserve the order the caller asked for; Magento returns catalogue order.
  const bySku = new Map(found.map((product) => [product.sku, product]));
  return skus
    .map((sku) => bySku.get(sku))
    .filter((product): product is MagentoProduct => product !== undefined);
}

export async function fetchProductsInCategory(
  magentoApi: MagentoClient,
  categoryId: string,
  limit: number,
): Promise<MagentoProduct[]> {
  const params = singleFilter('category_id', categoryId);
  params.set('searchCriteria[pageSize]', String(limit));
  params.set('searchCriteria[currentPage]', '1');

  const result = await magentoApi.searchProducts(params);
  return result.items ?? [];
}

/**
 * Magento has no notion of a product collection, so a collection name is
 * resolved against the category tree by `external_id`, `url_key` and `name`.
 */
export async function findCategoryByName(
  magentoApi: MagentoClient,
  collectionName: string,
): Promise<MagentoCategory | null> {
  const client = await magentoApi.getClient();

  for (const field of ['external_id', 'url_key', 'name']) {
    const params = singleFilter(field, collectionName);
    params.set('searchCriteria[pageSize]', '1');
    try {
      const response = await client.store.category.list(params);
      const category = response.items?.[0];
      if (category) {
        return category;
      }
    } catch {
      // try the next field
    }
  }

  return null;
}
