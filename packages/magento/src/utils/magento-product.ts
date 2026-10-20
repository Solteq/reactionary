import {
  ImageSchema,
  ProductSearchResultItemComplianceDataSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  type Image,
  type ProductSearchResultItem,
  type ProductSearchResultItemComplianceData,
  type ProductSearchResultItemVariant,
  type ProductVariantIdentifier,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoProduct } from '../schema/magento.types.js';

const debug = createDebug('reactionary:magento:product-media');

export function getCustomAttribute(
  product: MagentoProduct,
  code: string,
): string | undefined {
  if (!product.custom_attributes) return undefined;
  const found = product.custom_attributes.find((a) => a.attribute_code === code);
  if (found?.value === null || found?.value === undefined) return undefined;
  return String(found.value);
}

/**
 * The `external_id` carries the identifier the surrounding commerce landscape
 * uses. Depending on how it was added to Magento it surfaces either as an
 * extension attribute or as a plain EAV (custom) attribute, so both are checked.
 */
export function getProductExternalId(
  product: MagentoProduct,
): string | undefined {
  const fromExtension = product.extension_attributes?.['external_id'];
  if (typeof fromExtension === 'string' || typeof fromExtension === 'number') {
    return String(fromExtension);
  }
  return getCustomAttribute(product, 'external_id');
}

export function getProductKey(product: MagentoProduct): string {
  return (
    getProductExternalId(product) ??
    (product.id !== undefined ? String(product.id) : product.sku)
  );
}

/**
 * `original_dam_reference` holds the PIM-sorted DAM imagery. Order is
 * significant: the first entry is the primary image.
 *
 * Expected attribute value:
 * ```json
 * {
 *   "images": [
 *     {
 *       "url": "https://dam.example/a.jpg",
 *       "altText": "Front view",
 *       "dimensions": { "width": 400, "height": 600 }
 *     }
 *   ]
 * }
 * ```
 */
export function parseDamImages(
  raw: string | undefined,
  fallbackAltText: string,
): Image[] {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    debug('original_dam_reference is not valid JSON: %s', trimmed);
    return [];
  }

  if (!isRecord(parsed) || !Array.isArray(parsed['images'])) {
    debug('original_dam_reference has no "images" array: %s', trimmed);
    return [];
  }

  return parsed['images']
    .map((entry) => parseDamImage(entry, fallbackAltText))
    .filter((image): image is Image => image !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPixelSize(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseDamImage(entry: unknown, fallbackAltText: string): Image | null {
  if (!isRecord(entry)) {
    return null;
  }

  const url = entry['url'];
  if (typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }

  const altText = entry['altText'];
  const dimensions = isRecord(entry['dimensions']) ? entry['dimensions'] : undefined;

  return ImageSchema.parse({
    sourceUrl: url.trim(),
    altText:
      typeof altText === 'string' && altText.trim().length > 0
        ? altText.trim()
        : fallbackAltText,
    width: toPixelSize(dimensions?.['width']),
    height: toPixelSize(dimensions?.['height']),
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function buildMagentoImageUrl(
  config: MagentoConfiguration,
  file: string,
): string {
  const mediaUrl = config.mediaUrl;
  if (mediaUrl) {
    return `${mediaUrl.replace(/\/+$/, '')}${file.startsWith('/') ? '' : '/'}${file}`;
  }

  const storeBase = normalizeBaseUrl(config.baseUrl);
  return `${storeBase}/media/catalog/product${file.startsWith('/') ? '' : '/'}${file}`;
}

/**
 * The product's images in display order. With `mediaSource: 'EXTERNAL'` they
 * come from the DAM reference attribute, otherwise from the enabled Magento
 * media gallery entries (sorted by position, the `role` image first when given).
 */
export function parseMagentoProductImages(
  config: MagentoConfiguration,
  product: MagentoProduct,
  role?: string,
): Image[] {
  const altText = product.name || product.sku;

  if (config.mediaSource === 'EXTERNAL') {
    return parseDamImages(getCustomAttribute(product, 'original_dam_reference'), altText);
  }

  const entries = (product.media_gallery_entries ?? [])
    .filter((entry) => entry.file.length > 0 && !entry.disabled)
    .filter((entry) => entry.media_type === undefined || entry.media_type === 'image')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (role) {
    const primaryIndex = entries.findIndex((entry) => (entry.types ?? []).includes(role));
    if (primaryIndex > 0) {
      entries.unshift(...entries.splice(primaryIndex, 1));
    }
  }

  return entries.map((entry) =>
    ImageSchema.parse({
      sourceUrl: buildMagentoImageUrl(config, entry.file),
      altText: entry.label?.trim() || altText,
    }),
  );
}

/** Product types that require an option choice (or several products) before they can be carted. */
const NOT_DIRECTLY_PURCHASABLE_TYPES = ['configurable', 'bundle', 'grouped'];

/**
 * Whether a PLP may offer add-to-cart for this product: configurable, bundle
 * and grouped products always need the PDP to pick the concrete item(s).
 */
export function canAddMagentoProductToCartDirectly(product: MagentoProduct): boolean {
  return !NOT_DIRECTLY_PURCHASABLE_TYPES.includes(product.type_id ?? 'simple');
}

export function buildProductSearchResultItemVariant(
  config: MagentoConfiguration,
  variant: MagentoProduct,
  product: MagentoProduct,
): ProductSearchResultItemVariant {
  const [first] = parseMagentoProductImages(config, product, 'small_image');

  const img = first ?? ImageSchema.parse({
    sourceUrl: '',
    altText: product.name || undefined,
  });

  return ProductSearchResultItemVariantSchema.parse({
    variant: ProductVariantIdentifierSchema.parse({
      sku: variant.sku,
    } satisfies ProductVariantIdentifier),
    image: img,
  } satisfies Partial<ProductSearchResultItemVariant>);
}

/**
 * Builds the search-result representation of a product. Products are keyed by
 * `getProductKey` (external_id, falling back to the entity id), the same key
 * the product, search, association and recommendation capabilities use.
 */
export function buildProductSearchResultItem(
  config: MagentoConfiguration,
  product: MagentoProduct,
): ProductSearchResultItem {
  const variants: ProductSearchResultItemVariant[] = [];
  if (product.sku) {
    variants.push(buildProductSearchResultItemVariant(config, product, product));
  }

  return {
    identifier: { key: getProductKey(product) },
    name: product.name || product.sku,
    slug:
      getCustomAttribute(product, 'url_key') ??
      getCustomAttribute(product, 'url_path') ??
      '',
    canAddToCartDirectly: variants.length === 1 && canAddMagentoProductToCartDirectly(product),
    variants,
    complianceData: buildProductComplianceData(product),
  } satisfies ProductSearchResultItem;
}

function buildProductComplianceData(_product: MagentoProduct): ProductSearchResultItemComplianceData {
  return ProductSearchResultItemComplianceDataSchema.parse({});
}
