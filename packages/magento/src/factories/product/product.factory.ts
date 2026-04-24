import {
  CategoryIdentifierSchema,
  ProductIdentifierSchema,
  type AnyProductSchema,
  type Image,
  type Product,
  type ProductAttribute,
  type ProductAttributeIdentifier,
  type ProductAttributeValueIdentifier,
  type ProductFactory,
  type ProductSchema,
  type ProductVariant,
  type ProductVariantOption,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoProduct } from '../../schema/magento.types.js';

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
  if (!product.custom_attributes) return undefined;
  const found = product.custom_attributes.find((a) => a.attribute_code === code);
  if (found?.value === null || found?.value === undefined) return undefined;
  return String(found.value);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildMagentoImageUrl(config: MagentoConfiguration, file: string): string {
  const mediaUrl = config.mediaUrl;
  if (mediaUrl) {
    return `${mediaUrl.replace(/\/+$/, '')}${file.startsWith('/') ? '' : '/'}${file}`;
  }

  const storeBase = `${normalizeBaseUrl(config.baseUrl)}`;
  return `${storeBase}/media/catalog/product${file.startsWith('/') ? '' : '/'}${file}`;
}

export class MagentoProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  constructor(
    productSchema: TProductSchema,
    protected config: MagentoConfiguration,
  ) {
    this.productSchema = productSchema;
  }

  public parseProduct(
    _context: RequestContext,
    data: MagentoProduct,
  ): z.output<TProductSchema> {
    const sku = data.sku;
    const idKey = data.id !== undefined ? String(data.id) : sku;

    const identifier = ProductIdentifierSchema.parse({ key: idKey });

    const name = data.name || sku;
    const slug =
      getCustomAttribute(data, 'url_key') ??
      getCustomAttribute(data, 'url_path') ??
      '';

    const description =
      getCustomAttribute(data, 'description') ??
      getCustomAttribute(data, 'short_description') ??
      '';

    const categoryLinks = data.extension_attributes?.category_links;
    const parentCategories = categoryLinks
      ? categoryLinks
          .map((c) => c.category_id)
          .filter((x) => x !== null && x !== undefined)
          .map((cid) => CategoryIdentifierSchema.parse({ key: String(cid) }))
      : [];

    const sharedAttributes = this.parseAttributes(data);
    const mainVariant = this.parseVariant(data);

    const result = {
      brand: getCustomAttribute(data, 'manufacturer') ?? '',
      description,
      identifier,
      longDescription: '',
      mainVariant,
      manufacturer: getCustomAttribute(data, 'manufacturer') ?? '',
      name,
      options: [],
      parentCategories,
      published: true,
      sharedAttributes,
      slug,
      variants: [],
    } satisfies Product;

    return this.productSchema.parse(result);
  }

  protected parseVariant(product: MagentoProduct): ProductVariant {
    const sku = product.sku;

    const ean =
      getCustomAttribute(product, 'ean') ??
      getCustomAttribute(product, 'gtin') ??
      getCustomAttribute(product, 'barcode') ??
      '';

    const upc = getCustomAttribute(product, 'upc') ?? '';

    const images: Image[] = (product.media_gallery_entries ?? [])
      .filter((m) => m.file.length > 0)
      .map((m) => ({
        sourceUrl: buildMagentoImageUrl(this.config, m.file),
        altText: product.name || sku,
      } satisfies Image));

    const options: ProductVariantOption[] = [];

    return {
      identifier: { sku },
      name: product.name || sku,
      upc,
      ean,
      images,
      options,
      gtin: ean,
      barcode: ean,
    } satisfies ProductVariant;
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

  protected parseAttributes(product: MagentoProduct): Array<ProductAttribute> {
    const sharedAttributes: ProductAttribute[] = [];

    if (!product.custom_attributes) return sharedAttributes;

    for (const entry of product.custom_attributes) {
      const key = entry.attribute_code;
      const value = entry.value;

      if (!key) continue;
      if (key === 'description' || key === 'short_description') continue;
      if (value === null || value === undefined) continue;

      const stringValue =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

      sharedAttributes.push(this.createSynthAttribute(key, key, stringValue));
    }

    return sharedAttributes;
  }
}
