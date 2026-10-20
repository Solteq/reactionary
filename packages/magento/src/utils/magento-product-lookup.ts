import { error, type NotFoundError, type Fail } from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import { isMagentoApiError } from '../core/errors.js';
import type {
  MagentoCategory,
  MagentoCategorySearchResult,
  MagentoProduct,
} from '../schema/magento.types.js';
import {
  handleMagentoProviderError,
  isMagentoNotFoundError,
} from './magento-errors.js';

/** Magento's `status` attribute value for an enabled product. */
export const MAGENTO_PRODUCT_STATUS_ENABLED = 1;

/**
 * The visibilities under which Magento itself lists a product in catalog
 * blocks (related/up-sell/cross-sell, category listings): "Catalog" (2) and
 * "Catalog, Search" (4). "Not Visible Individually" (1) and "Search" (3) are
 * excluded, mirroring `Visibility::getVisibleInCatalogIds()`.
 */
export const MAGENTO_VISIBLE_IN_CATALOG = [2, 4];

/**
 * Thrown by the lookup helpers when a reactionary key does not match any
 * Magento entity. Capabilities turn it into a `NotFound` result through
 * {@link handleMagentoLookupError}.
 */
export class MagentoLookupNotFoundError extends Error {
  public override readonly name = 'MagentoLookupNotFoundError';

  constructor(
    public readonly entity: 'product' | 'category',
    public readonly key: string,
  ) {
    super(`No Magento ${entity} matches the key "${key}".`);
  }
}

/**
 * As {@link handleMagentoProviderError}, but also maps a
 * {@link MagentoLookupNotFoundError} onto `NotFound`.
 */
export function handleMagentoLookupError(
  action: string,
  err: unknown,
  identifier: unknown,
): Fail<NotFoundError> {
  if (err instanceof MagentoLookupNotFoundError) {
    return error<NotFoundError>({ type: 'NotFound', identifier });
  }
  return handleMagentoProviderError(action, err, identifier);
}

interface FilterSpec {
  field: string;
  value: string;
  conditionType: 'eq' | 'in' | 'neq' | 'like';
}

/** Builds search criteria with one filter per group, i.e. the filters are ANDed. */
function buildCriteria(filters: FilterSpec[]): URLSearchParams {
  const params = new URLSearchParams();
  filters.forEach((filter, index) => {
    const prefix = `searchCriteria[filterGroups][${index}][filters][0]`;
    params.set(`${prefix}[field]`, filter.field);
    params.set(`${prefix}[value]`, filter.value);
    params.set(`${prefix}[condition_type]`, filter.conditionType);
  });
  return params;
}

/** Restricts a product search to products a shopper may see in the catalog. */
function storefrontVisibilityFilters(): FilterSpec[] {
  return [
    {
      field: 'status',
      value: String(MAGENTO_PRODUCT_STATUS_ENABLED),
      conditionType: 'eq',
    },
    {
      field: 'visibility',
      value: MAGENTO_VISIBLE_IN_CATALOG.join(','),
      conditionType: 'in',
    },
  ];
}

async function findFirstProductSku(
  magentoApi: MagentoClient,
  field: string,
  value: string,
): Promise<string | null> {
  const params = buildCriteria([{ field, value, conditionType: 'eq' }]);
  params.set('searchCriteria[pageSize]', '1');
  const result = await magentoApi.searchProducts(params);
  const sku = result.items?.[0]?.sku;
  return sku ? sku : null;
}

/**
 * Maps a reactionary product key onto a Magento SKU. Product keys are built by
 * `getProductKey` (the `external_id`, else the `entity_id`), so those are
 * tried first; a key that is itself an existing SKU is accepted last.
 *
 * Returns null when nothing matches. Transport failures are thrown.
 */
export async function resolveProductSku(
  magentoApi: MagentoClient,
  key: string,
): Promise<string | null> {
  try {
    const byExternalId = await findFirstProductSku(magentoApi, 'external_id', key);
    if (byExternalId) {
      return byExternalId;
    }
  } catch (err) {
    // A store without an `external_id` attribute rejects the filter with a
    // 400; the other strategies still apply.
    if (!(isMagentoApiError(err) && err.status === 400)) {
      throw err;
    }
  }

  if (/^\d+$/.test(key)) {
    const byEntityId = await findFirstProductSku(magentoApi, 'entity_id', key);
    if (byEntityId) {
      return byEntityId;
    }
  }

  return findFirstProductSku(magentoApi, 'sku', key);
}

/** As {@link resolveProductSku}, but throws a {@link MagentoLookupNotFoundError}. */
export async function requireProductSku(
  magentoApi: MagentoClient,
  key: string,
): Promise<string> {
  const sku = await resolveProductSku(magentoApi, key);
  if (!sku) {
    throw new MagentoLookupNotFoundError('product', key);
  }
  return sku;
}

/**
 * Loads the enabled, catalog-visible products among `skus`, in the order
 * given. Disabled or hidden products are dropped, as Magento's own link
 * blocks do.
 */
export async function fetchProductsBySkus(
  magentoApi: MagentoClient,
  skus: string[],
): Promise<MagentoProduct[]> {
  if (skus.length === 0) {
    return [];
  }

  const params = buildCriteria([
    { field: 'sku', value: skus.join(','), conditionType: 'in' },
    ...storefrontVisibilityFilters(),
  ]);
  params.set('searchCriteria[pageSize]', String(skus.length));

  const result = await magentoApi.searchProducts(params);
  const found = result.items ?? [];

  // Preserve the order the caller asked for; Magento returns catalogue order.
  const bySku = new Map(found.map((product) => [product.sku, product]));
  return skus
    .map((sku) => bySku.get(sku))
    .filter((product): product is MagentoProduct => product !== undefined);
}

export interface MagentoCategoryProductsOptions {
  /** Sort field, e.g. `created_at`. Catalogue order when omitted. */
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * Loads enabled, catalog-visible products assigned to a category. Note that
 * the REST `category_id` filter matches direct assignments only: products of
 * child categories are not included, even for anchor categories.
 */
export async function fetchProductsInCategory(
  magentoApi: MagentoClient,
  categoryId: string,
  limit: number,
  options: MagentoCategoryProductsOptions = {},
): Promise<MagentoProduct[]> {
  const params = buildCriteria([
    { field: 'category_id', value: categoryId, conditionType: 'eq' },
    ...storefrontVisibilityFilters(),
  ]);
  params.set('searchCriteria[pageSize]', String(limit));
  params.set('searchCriteria[currentPage]', '1');
  if (options.sortField) {
    params.set('searchCriteria[sortOrders][0][field]', options.sortField);
    params.set(
      'searchCriteria[sortOrders][0][direction]',
      options.sortDirection ?? 'ASC',
    );
  }

  const result = await magentoApi.searchProducts(params);
  return result.items ?? [];
}

async function findFirstCategory(
  magentoApi: MagentoClient,
  field: string,
  value: string,
): Promise<MagentoCategory | null> {
  const params = buildCriteria([{ field, value, conditionType: 'eq' }]);
  params.set('searchCriteria[pageSize]', '1');
  try {
    const response = await magentoApi.catalogRequest<MagentoCategorySearchResult>(
      `/V1/categories/list?${params.toString()}`,
    );
    return response.items?.[0] ?? null;
  } catch (err) {
    // An unknown attribute (e.g. no `external_id` on categories) is a 400.
    if (isMagentoApiError(err) && err.status === 400) {
      return null;
    }
    throw err;
  }
}

/**
 * Magento has no notion of a product collection, so a collection name is
 * resolved against the category tree by `external_id`, `url_key` and `name`.
 */
export async function findCategoryByName(
  magentoApi: MagentoClient,
  collectionName: string,
): Promise<MagentoCategory | null> {
  for (const field of ['external_id', 'url_key', 'name']) {
    const category = await findFirstCategory(magentoApi, field, collectionName);
    if (category) {
      return category;
    }
  }
  return null;
}

/**
 * Resolves a reactionary category key, which the category factory builds from
 * the `external_id` and else the Magento entity id.
 */
export async function resolveCategoryByKey(
  magentoApi: MagentoClient,
  key: string,
): Promise<MagentoCategory | null> {
  const byExternalId = await findFirstCategory(magentoApi, 'external_id', key);
  if (byExternalId) {
    return byExternalId;
  }

  if (/^\d+$/.test(key)) {
    try {
      return await magentoApi.catalogRequest<MagentoCategory>(
        `/V1/categories/${encodeURIComponent(key)}`,
      );
    } catch (err) {
      if (isMagentoNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }

  return null;
}

/** As {@link resolveCategoryByKey}, but throws a {@link MagentoLookupNotFoundError}. */
export async function requireCategoryByKey(
  magentoApi: MagentoClient,
  key: string,
): Promise<MagentoCategory> {
  const category = await resolveCategoryByKey(magentoApi, key);
  if (!category) {
    throw new MagentoLookupNotFoundError('category', key);
  }
  return category;
}

/** The Magento category ids a product is assigned to. */
export function getProductCategoryIds(product: MagentoProduct): string[] {
  return (product.extension_attributes?.category_links ?? []).map((link) =>
    String(link.category_id),
  );
}
