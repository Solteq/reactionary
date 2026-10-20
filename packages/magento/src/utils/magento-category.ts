import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCategory } from '../schema/magento.types.js';

/** The value of a category custom attribute, or undefined when unset or empty. */
export function getCategoryAttribute(
  category: MagentoCategory,
  code: string,
): string | undefined {
  const found = category.custom_attributes?.find((a) => a.attribute_code === code);
  const value = found?.value;
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * The key Reactionary addresses a category by: its `external_id`, falling back
 * to the Magento entity id for categories that carry none. Every category key
 * the provider emits (category identifiers, parent pointers, product
 * `parentCategories`, the search category facet) uses this scheme.
 */
export function getCategoryKey(category: MagentoCategory): string {
  return getCategoryAttribute(category, 'external_id') ?? String(category.id);
}

/**
 * The entity ids of the category's ancestors below the store root, root-most
 * first, followed by the category itself. Read from the category `path`
 * (`1/2/5/12` → `['5', '12']` for root `2`). Returns null when the category
 * does not live beneath the configured root, i.e. belongs to another store.
 */
export function getCategoryPathBelowRoot(
  category: MagentoCategory,
  rootCategoryId: string,
): string[] | null {
  const path = (category.path ?? '').split('/').filter((segment) => segment.length > 0);
  if (path.length === 0) {
    return [String(category.id)];
  }
  const rootIndex = path.indexOf(String(rootCategoryId));
  if (rootIndex === -1) {
    return null;
  }
  return path.slice(rootIndex + 1);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Category images are stored either as a bare file name (relative to
 * `media/catalog/category`) or, since 2.3, as a path below the web root
 * (`/media/catalog/category/x.jpg`). Absolute URLs are passed through.
 */
export function buildMagentoCategoryImageUrl(
  config: Pick<MagentoConfiguration, 'baseUrl'>,
  value: string,
): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = normalizeBaseUrl(config.baseUrl);
  if (/^\/?(pub\/)?media\//.test(trimmed)) {
    return `${base}/${trimmed.replace(/^\/+/, '')}`;
  }
  return `${base}/media/catalog/category/${trimmed.replace(/^\/+/, '')}`;
}

/**
 * The facet key the product search encodes category navigation with. Its
 * values are category keys (see `getCategoryKey`), never entity ids.
 */
export const MAGENTO_CATEGORY_FACET_KEY = 'categories';
