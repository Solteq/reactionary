import type { MagentoCategory } from '../schema/magento.types.js';

/**
 * The Reactionary key of a Magento category: its `external_id` custom
 * attribute when the store sets one, otherwise the numeric entity id.
 * Mirrors `getProductKey`.
 */
export function getCategoryKey(category: MagentoCategory): string {
  const externalId = category.custom_attributes?.find((a) => a.attribute_code === 'external_id')?.value;
  return String(externalId || category.id);
}

/** A key that can also be read as a Magento entity id. */
export function isCategoryEntityIdKey(key: string): boolean {
  return /^\d+$/.test(key);
}
