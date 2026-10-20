import {
  CategoryIdentifierSchema,
  ProductComplianceDataSchema,
  ProductIdentifierSchema,
  type AnyProductSchema,
  type CategoryIdentifier,
  type Image,
  type Product,
  type ProductAttribute,
  type ProductAttributeIdentifier,
  type ProductAttributeValue,
  type ProductAttributeValueIdentifier,
  type ProductComplianceData,
  type ProductFactory,
  type ProductOption,
  type ProductSchema,
  type ProductVariant,
  type ProductVariantOption,
  type RequestContext,
} from '@reactionary/core';
import createDebug from 'debug';
import type * as z from 'zod';
import type {
  MagentoAttributeCatalog,
  MagentoAttributeMetadata,
  MagentoProductDetails,
} from '../../schema/catalog.types.js';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoProduct } from '../../schema/magento.types.js';
import {
  getCustomAttribute,
  getProductKey,
  parseMagentoProductImages,
} from '../../utils/magento-product.js';

const debug = createDebug('reactionary:magento:product');

/**
 * System / layout attributes that are never shown to shoppers. Only consulted
 * when the attribute set metadata (`is_visible_on_front`) cannot be read.
 */
export const MAGENTO_SYSTEM_ATTRIBUTE_CODES: ReadonlySet<string> = new Set([
  'category_ids',
  'cost',
  'custom_design',
  'custom_design_from',
  'custom_design_to',
  'custom_layout',
  'custom_layout_update',
  'custom_layout_update_file',
  'description',
  'external_id',
  'gift_message_available',
  'gift_wrapping_available',
  'gift_wrapping_price',
  'has_options',
  'image',
  'image_label',
  'is_returnable',
  'links_exist',
  'links_purchased_separately',
  'links_title',
  'meta_description',
  'meta_keyword',
  'meta_title',
  'minimal_price',
  'msrp',
  'msrp_display_actual_price_type',
  'news_from_date',
  'news_to_date',
  'options_container',
  'original_dam_reference',
  'page_layout',
  'price',
  'price_type',
  'price_view',
  'quantity_and_stock_status',
  'required_options',
  'samples_title',
  'shipment_type',
  'short_description',
  'sku_type',
  'small_image',
  'small_image_label',
  'special_from_date',
  'special_price',
  'special_to_date',
  'status',
  'swatch_image',
  'tax_class_id',
  'thumbnail',
  'thumbnail_label',
  'tier_price',
  'url_key',
  'url_path',
  'visibility',
  'weight',
  'weight_type',
]);

/** Attributes mapped onto dedicated product fields and therefore never repeated as shared attributes. */
const DEDICATED_ATTRIBUTE_CODES: ReadonlySet<string> = new Set(['description', 'short_description']);

/** A configurable attribute of a product, resolved to its attribute code and labels. */
export interface MagentoProductOptionDefinition {
  code: string;
  name: string;
  values: Array<{ value: string; label: string }>;
}

export function isMagentoProductDetails(
  data: MagentoProduct | MagentoProductDetails,
): data is MagentoProductDetails {
  return 'product' in data && typeof data.product === 'object' && data.product !== null;
}

function scalarToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
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

  protected parseComplianceData(_context: RequestContext, _data: MagentoProduct): ProductComplianceData {
    return ProductComplianceDataSchema.parse({});
  }

  /**
   * Maps a Magento product. Accepts the bare REST product, or the
   * `MagentoProductDetails` the capability assembles (configurable children
   * and options, attribute metadata, category keys) for a complete mapping.
   */
  public parseProduct(
    context: RequestContext,
    data: MagentoProduct | MagentoProductDetails,
  ): z.output<TProductSchema> {
    const details: MagentoProductDetails = isMagentoProductDetails(data) ? data : { product: data };
    const product = details.product;
    const sku = product.sku;

    const identifier = ProductIdentifierSchema.parse({ key: getProductKey(product) });

    const name = product.name || sku;
    const slug =
      getCustomAttribute(product, 'url_key') ??
      getCustomAttribute(product, 'url_path') ??
      '';

    const longDescription = getCustomAttribute(product, 'description') ?? '';
    const description = getCustomAttribute(product, 'short_description') ?? longDescription;

    const parentCategories = this.parseParentCategories(product, details.categoryKeys);

    const optionDefinitions = this.parseOptionDefinitions(details);
    const options = optionDefinitions.map((definition) => this.parseOption(definition));

    const sharedAttributes = this.parseAttributes(
      product,
      details.attributes,
      new Set(optionDefinitions.map((definition) => definition.code)),
    );

    const children = details.children ?? [];
    const mainChild =
      children.find((child) => child.sku === details.preferredSku) ?? children[0];
    const mainVariant = mainChild
      ? this.parseVariant(mainChild, product, optionDefinitions)
      : this.parseVariant(product);
    const variants = children
      .filter((child) => child !== mainChild)
      .map((child) => this.parseVariant(child, product, optionDefinitions));

    const manufacturer = this.getAttributeLabel(product, 'manufacturer', details.attributes) ?? '';
    const brand = this.getAttributeLabel(product, 'brand', details.attributes) ?? manufacturer;

    const result = {
      brand,
      description,
      identifier,
      longDescription,
      mainVariant,
      manufacturer,
      name,
      options,
      parentCategories,
      published: this.isPublished(product),
      sharedAttributes,
      slug,
      variants,
      complianceData: this.parseComplianceData(context, product),
    } satisfies Product;

    return this.productSchema.parse(result);
  }

  /** A product is published when it is enabled (`status` 1). */
  protected isPublished(product: MagentoProduct): boolean {
    return product.status === undefined || Number(product.status) === 1;
  }

  /**
   * Category links carry Magento entity ids; categories are keyed by
   * `external_id` (see `getCategoryKey`), so ids are translated through
   * `categoryKeys`. Without a translation table the raw ids are kept.
   */
  protected parseParentCategories(
    product: MagentoProduct,
    categoryKeys: Record<string, string> | undefined,
  ): CategoryIdentifier[] {
    const ids = (product.extension_attributes?.category_links ?? [])
      .map((link) => link.category_id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => String(id));

    const keys = categoryKeys
      ? ids.map((id) => categoryKeys[id]).filter((key): key is string => key !== undefined)
      : ids;

    return [...new Set(keys)].map((key) => CategoryIdentifierSchema.parse({ key }));
  }

  /**
   * Resolves the configurable attributes (`attribute_id`) to attribute codes
   * through the attribute metadata, keeping only the values at least one
   * enabled child actually uses.
   */
  protected parseOptionDefinitions(details: MagentoProductDetails): MagentoProductOptionDefinition[] {
    const configurableOptions = details.configurableOptions ?? [];
    if (configurableOptions.length === 0) {
      return [];
    }

    const byId = new Map<string, MagentoAttributeMetadata>();
    for (const attribute of details.attributes?.attributes ?? []) {
      if (attribute.attributeId) byId.set(attribute.attributeId, attribute);
    }
    const children = details.children ?? [];

    const definitions: MagentoProductOptionDefinition[] = [];
    for (const option of [...configurableOptions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const metadata = byId.get(String(option.attribute_id));
      if (!metadata) {
        debug(`Configurable attribute ${option.attribute_id} has no metadata; option skipped`);
        continue;
      }
      const usedValues = new Set(
        children
          .map((child) => getCustomAttribute(child, metadata.code))
          .filter((value): value is string => value !== undefined),
      );
      const values = option.values
        .map((value) => String(value.value_index))
        .filter((value) => children.length === 0 || usedValues.has(value))
        .map((value) => ({
          value,
          label: metadata.options.find((o) => o.value === value)?.label ?? value,
        }));

      definitions.push({
        code: metadata.code,
        name: option.label || metadata.label,
        values,
      });
    }
    return definitions;
  }

  protected parseOption(definition: MagentoProductOptionDefinition): ProductOption {
    const optionIdentifier = { key: definition.code };
    return {
      identifier: optionIdentifier,
      name: definition.name,
      values: definition.values.map((value) => ({
        identifier: { option: optionIdentifier, key: value.value },
        label: value.label,
      })),
    } satisfies ProductOption;
  }

  /**
   * Maps a sellable item. `parent` is the configurable product a child belongs
   * to (its images are used when the child has none of its own) and
   * `optionDefinitions` the configurable attributes the child's options are read from.
   */
  protected parseVariant(
    product: MagentoProduct,
    parent?: MagentoProduct,
    optionDefinitions: MagentoProductOptionDefinition[] = [],
  ): ProductVariant {
    const sku = product.sku;

    const ean =
      getCustomAttribute(product, 'ean') ??
      getCustomAttribute(product, 'gtin') ??
      getCustomAttribute(product, 'barcode') ??
      '';

    const upc = getCustomAttribute(product, 'upc') ?? '';

    let images = this.parseImages(product);
    if (images.length === 0 && parent) {
      images = this.parseImages(parent);
    }

    const options: ProductVariantOption[] = [];
    for (const definition of optionDefinitions) {
      const value = getCustomAttribute(product, definition.code);
      if (value === undefined) continue;
      const optionIdentifier = { key: definition.code };
      options.push({
        identifier: optionIdentifier,
        name: definition.name,
        value: {
          identifier: { option: optionIdentifier, key: value },
          label: definition.values.find((v) => v.value === value)?.label ?? value,
        },
      });
    }

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

  protected parseImages(product: MagentoProduct): Image[] {
    return parseMagentoProductImages(this.config, product, 'image');
  }

  protected createSynthAttribute(
    key: string,
    name: string,
    value: string,
    label: string = value,
  ): ProductAttribute {
    const attributeIdentifier: ProductAttributeIdentifier = { key };
    const valueIdentifier: ProductAttributeValueIdentifier = { key: `${key}-${value}` };

    return {
      identifier: attributeIdentifier,
      name,
      group: '',
      values: [
        {
          identifier: valueIdentifier,
          label,
          value,
        },
      ],
    } satisfies ProductAttribute;
  }

  /** The store label of an option-based attribute value (option ids resolved), or the raw value. */
  protected getAttributeLabel(
    product: MagentoProduct,
    code: string,
    attributes: MagentoAttributeCatalog | undefined,
  ): string | undefined {
    const raw = getCustomAttribute(product, code);
    if (raw === undefined || raw === '') return undefined;
    const metadata = attributes?.attributes.find((a) => a.code === code);
    if (!metadata || metadata.options.length === 0) return raw;
    return raw
      .split(',')
      .map((value) => metadata.options.find((o) => o.value === value.trim())?.label ?? value.trim())
      .join(', ');
  }

  /**
   * The shopper-facing technical attributes. With the attribute set metadata
   * available only `is_visible_on_front` attributes are listed; otherwise the
   * known system attributes are excluded. Option ids are resolved to labels.
   */
  protected parseAttributes(
    product: MagentoProduct,
    attributes?: MagentoAttributeCatalog,
    excludedCodes: ReadonlySet<string> = new Set(),
  ): Array<ProductAttribute> {
    const sharedAttributes: ProductAttribute[] = [];
    const metadataByCode = new Map((attributes?.attributes ?? []).map((a) => [a.code, a]));

    for (const entry of product.custom_attributes ?? []) {
      const key = entry.attribute_code;
      if (!key || DEDICATED_ATTRIBUTE_CODES.has(key) || excludedCodes.has(key)) continue;

      const metadata = metadataByCode.get(key);
      if (attributes?.complete) {
        if (!metadata?.visibleOnFront) continue;
      } else if (MAGENTO_SYSTEM_ATTRIBUTE_CODES.has(key)) {
        continue;
      }

      const raw = scalarToString(entry.value);
      if (raw === undefined || raw.trim() === '') continue;

      const isOptionBased = metadata !== undefined && metadata.options.length > 0;
      const rawValues = isOptionBased && metadata.frontendInput === 'multiselect'
        ? raw.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
        : [raw];

      const values: ProductAttributeValue[] = rawValues.map((value) => ({
        identifier: { key: `${key}-${value}` },
        value,
        label: isOptionBased
          ? metadata.options.find((o) => o.value === value)?.label ?? value
          : value,
      }));

      sharedAttributes.push({
        identifier: { key },
        name: metadata?.label ?? key,
        group: '',
        values,
      } satisfies ProductAttribute);
    }

    return sharedAttributes;
  }
}
