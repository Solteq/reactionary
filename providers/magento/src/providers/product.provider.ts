import type {
  Cache,
  Image,
  NotFoundError,
  Product,
  ProductAttribute,
  ProductAttributeIdentifier,
  ProductAttributeValueIdentifier,
  ProductOptionIdentifier,
  ProductOptionValueIdentifier,
  ProductQueryById,
  ProductQueryBySKU,
  ProductQueryBySlug,
  ProductVariant,
  ProductVariantOption,
  RequestContext,
  Result,
} from '@reactionary/core';

import {
  CategoryIdentifierSchema,
  ProductIdentifierSchema,
  ProductProvider,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';

import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:magento:product');

/**
 * Magento product is not strongly typed here to keep provider independent of extra SDKs.
 * We map fields defensively.
 */
type MagentoProduct = any;

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
  const list = product?.custom_attributes;
  if (!Array.isArray(list)) return undefined;
  const found = list.find((a: any) => a?.attribute_code === code);
  const value = found?.value;
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Attempts to build a full image URL from Magento media_gallery_entries.
 * - If config has `mediaUrl`, it uses that
 * - else tries to derive store base from apiUrl by stripping `/rest`
 */
function buildMagentoImageUrl(config: MagentoConfiguration, file: string): string {
  const mediaUrl = (config as any).mediaUrl as string | undefined;
  if (mediaUrl) {
    return `${mediaUrl.replace(/\/+$/, '')}${file.startsWith('/') ? '' : '/'}${file}`;
  }

  const api = normalizeBaseUrl(config.apiUrl);

  const storeBase = api.replace(/\/rest.*$/i, '');
  return `${storeBase}/media/catalog/product${file.startsWith('/') ? '' : '/'}${file}`;
}

/**
 * Builds a Magento searchCriteria URL for products.
 */
function buildProductsSearchUrl(
  baseUrl: string,
  field: string,
  value: string | number,
  condition: 'eq' | 'like' = 'eq',
  pageSize = 1,
  currentPage = 1
): string {
  const b = normalizeBaseUrl(baseUrl);

  const params = new URLSearchParams();
  params.set('searchCriteria[filterGroups][0][filters][0][field]', field);
  params.set('searchCriteria[filterGroups][0][filters][0][value]', String(value));
  params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', condition);
  params.set('searchCriteria[pageSize]', String(pageSize));
  params.set('searchCriteria[currentPage]', String(currentPage));

  return `${b}/V1/products?${params.toString()}`;
}

/**
 * Fetches a product list via Magento Admin token (Bearer).
 * Used for slug lookup (url_key) and by-id lookup (entity_id).
 */
async function adminSearchProducts(
  config: MagentoConfiguration,
  field: string,
  value: string | number
): Promise<{ items: MagentoProduct[]; total_count?: number }> {
  const token = (config as any).adminApiKey as string | undefined;
  if (!token) {
    throw new Error(
      `Magento admin search requires admin token. Missing config.adminApiKey for field=${field}.`
    );
  }

  const url = buildProductsSearchUrl(config.apiUrl, field, value, 'eq', 1, 1);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Magento admin search failed: GET ${url} -> ${res.status} ${res.statusText}\n${text}`
    );
  }

  return (await res.json()) as { items: MagentoProduct[]; total_count?: number };
}

export class MagentoProductProvider extends ProductProvider {
  protected config: MagentoConfiguration;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public client: MagentoClient
  ) {
    super(cache, context);
    this.config = config;
  }


  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
  })
  public override async getById(payload: ProductQueryById): Promise<Result<Product>> {
    const key = payload.identifier.key;

    if (debug.enabled) {
      debug(`Fetching product by ID/key: ${key}`);
    }

    try {
      // If numeric, try admin search by entity_id
      if (/^\d+$/.test(key)) {
        const result = await adminSearchProducts(this.config, 'entity_id', Number(key));
        const product = result.items?.[0];
        if (!product) {
          return success(this.createEmptyProduct(key));
        }
        return success(this.parseSingle(product));
      }

      const product = await this.client.getProductBySKU(key);
      return success(this.parseSingle(product));
    } catch (e) {
      if (debug.enabled) {
        debug(`Product with key ${key} not found. Error %O`, e);
      }
      return success(this.createEmptyProduct(key));
    }
  }

  /**
   * Magento slug is commonly stored in custom_attribute "url_key".
   * Public API doesn't offer a direct /by-slug endpoint -> we do admin search by url_key (requires admin token).
   */
  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema.nullable(),
  })
  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<Result<Product, NotFoundError>> {
    if (debug.enabled) {
      debug(`Fetching product by slug(url_key): ${payload.slug}`);
    }

    try {
      const result = await adminSearchProducts(this.config, 'url_key', payload.slug);
      const product = result.items?.[0];

      if (!product) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }

      return success(this.parseSingle(product));
    } catch (e) {
      if (debug.enabled) {
        debug(`Slug lookup failed for ${payload.slug}. Error %O`, e);
      }
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(payload: ProductQueryBySKU): Promise<Result<Product>> {
    const sku = payload.variant.sku;

    if (debug.enabled) {
      debug(`Fetching product by SKU: ${sku}`);
    }

    const product = await this.client.getProductBySKU(sku);

    return success(this.parseSingle(product, sku));
  }

  protected parseSingle(body: MagentoProduct, onlySku?: string): Product {
    const sku: string = String(body?.sku ?? onlySku ?? '');
    const idKey: string = body?.id !== undefined ? String(body.id) : sku;

    const identifier = ProductIdentifierSchema.parse({ key: idKey });

    const name: string = String(body?.name ?? sku);
    const slug: string =
      getCustomAttribute(body, 'url_key') ??
      getCustomAttribute(body, 'url_path') ??
      '';

    const description: string =
      getCustomAttribute(body, 'description') ??
      getCustomAttribute(body, 'short_description') ??
      '';

    // Categories: extension_attributes.category_links[] with category_id
    const categoryLinks = body?.extension_attributes?.category_links;
    const parentCategories =
      Array.isArray(categoryLinks)
        ? categoryLinks
          .map((c: any) => c?.category_id)
          .filter((x: any) => x !== null && x !== undefined)
          .map((cid: any) => CategoryIdentifierSchema.parse({ key: String(cid) }))
        : [];

    // Shared attributes from custom_attributes
    const sharedAttributes = this.parseAttributes(body);

    // Main variant (Magento "simple product")
    const mainVariant = this.parseVariant(body);

    const result: Product = {
      brand: String(getCustomAttribute(body, 'manufacturer') ?? ''),
      description,
      identifier,
      longDescription: '',
      mainVariant,
      manufacturer: String(getCustomAttribute(body, 'manufacturer') ?? ''),
      name,
      options: [],
      parentCategories,
      published: true,
      sharedAttributes,
      slug,
      variants: [], // For configurable products, can expand this later
    };

    return result;
  }

  protected parseVariant(product: MagentoProduct): ProductVariant {
    const sku: string = String(product?.sku ?? '');


    const ean =
      getCustomAttribute(product, 'ean') ??
      getCustomAttribute(product, 'gtin') ??
      getCustomAttribute(product, 'barcode') ??
      '';

    const upc = getCustomAttribute(product, 'upc') ?? '';

    const media = product?.media_gallery_entries;
    const images: Image[] = Array.isArray(media)
      ? media
        .map((m: any) => m?.file)
        .filter((f: any) => typeof f === 'string' && f.length > 0)
        .map((file: string) => {
          return {
            sourceUrl: buildMagentoImageUrl(this.config, file),
            altText: String(product?.name ?? sku),
          } satisfies Image;
        })
      : [];

    const options: ProductVariantOption[] = [];

    const result: ProductVariant = {
      identifier: { sku },
      name: String(product?.name ?? sku),
      upc,
      ean,
      images,
      options,
      gtin: ean,
      barcode: ean,
    };

    return result;
  }

  protected createSynthAttribute(key: string, name: string, value: string): ProductAttribute {
    const attributeIdentifier: ProductAttributeIdentifier = { key };
    const valueIdentifier: ProductAttributeValueIdentifier = { key: `${key}-${value}` };

    return {
      identifier: attributeIdentifier,
      name,
      group: '',
      values: [
        {
          identifier: valueIdentifier,
          label: String(value),
          value,
        },
      ],
    } satisfies ProductAttribute;
  }

  /**
   * Turn Magento custom_attributes into ProductAttribute[].
   */
  protected parseAttributes(product: MagentoProduct): Array<ProductAttribute> {
    const sharedAttributes: ProductAttribute[] = [];

    const list = product?.custom_attributes;
    if (!Array.isArray(list)) return sharedAttributes;

    for (const entry of list) {
      const key = entry?.attribute_code;
      const value = entry?.value;

      if (!key) continue;

      if (key === 'description' || key === 'short_description') continue;

      if (value === null || value === undefined) continue;

      const stringValue =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

      sharedAttributes.push(this.createSynthAttribute(String(key), String(key), stringValue));
    }

    return sharedAttributes;
  }
}
