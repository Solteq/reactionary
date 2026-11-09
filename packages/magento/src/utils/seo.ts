import type { Seo } from '@reactionary/core';
import type { MagentoCustomAttribute } from '../schema/magento.types.js';

function authoredAttribute(
  attributes: MagentoCustomAttribute[] | undefined,
  code: string,
): string | undefined {
  const value = attributes?.find((a) => a.attribute_code === code)?.value;
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value).trim() || undefined;
}

/**
 * Maps the authored `meta_title` and `meta_description` of a product or category.
 * Magento returns them per store view, so they follow the store code the client is configured for.
 */
export function parseMagentoSeo(
  data: { custom_attributes?: MagentoCustomAttribute[] },
): Seo | undefined {
  const title = authoredAttribute(data.custom_attributes, 'meta_title');
  const description = authoredAttribute(data.custom_attributes, 'meta_description');

  if (title === undefined && description === undefined) {
    return undefined;
  }

  const seo: Seo = {};
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  return seo;
}
