import {
  CategoryIdentifierSchema,
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  ProductOptionSchema,
  ProductOptionValueSchema,
  ProductVariantOptionSchema,
  type ProductSchema,
  type AnyProductSchema,
  type Image,
  type Product,
  type ProductAttribute,
  type ProductFactory,
  type ProductOption,
  type ProductVariant,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  HclProductResponse,
  HclProductAttribute,
  HclProductAttributeValue,
} from '../../schema/hcl.schema.js';

const USAGE_DEFINING = 'Defining';
const USAGE_DESCRIPTIVE = 'Descriptive';

/** Flatten a single HCL attribute value entry, handling the string | string[] zip pattern. */
function flattenAttributeValues(
  attr: HclProductAttribute,
): Array<{ key: string; value: string; label: string }> {
  return attr.values.flatMap((v: HclProductAttributeValue) => {
    if (!Array.isArray(v.id)) {
      // Single value entry
      const value = Array.isArray(v.value)
        ? (v.value[0] ?? '')
        : (v.value ?? '');
      const key = Array.isArray(v.identifier)
        ? (v.identifier[0] ?? '')
        : (v.identifier ?? '');
      return [{ key: String(key), value: String(value), label: String(value) }];
    } else {
      // Multi-value entry — zip-expand each index into a separate flat value
      return v.id.map((_id, index) => {
        const key = Array.isArray(v.identifier)
          ? String(v.identifier[index] ?? '')
          : String(v.identifier ?? '');
        const value = Array.isArray(v.value)
          ? String(v.value[index] ?? '')
          : String(v.value ?? '');
        return { key, value, label: value };
      });
    }
  });
}

function parseSharedAttributes(data: HclProductResponse): ProductAttribute[] {
  return (data.attributes ?? [])
    .filter(
      (attr) =>
        attr.usage === USAGE_DESCRIPTIVE &&
        attr.displayable === 'true' &&
        attr.storeDisplay !== 'true',
    )
    .map((attr) => {
      const flatValues = flattenAttributeValues(attr);
      return ProductAttributeSchema.parse({
        identifier: ProductAttributeIdentifierSchema.parse({
          key: attr.identifier,
        }),
        group: '',
        name: attr.name,
        values: flatValues.map((fv) =>
          ProductAttributeValueSchema.parse({
            identifier: ProductAttributeValueIdentifierSchema.parse({
              key: fv.key,
            }),
            value: fv.value,
            label: fv.label,
          }),
        ),
      });
    });
}

function parseOptions(skus: HclProductResponse[]): ProductOption[] {
  // Collect unique defining attributes and all their values across all SKUs
  const optionMap = new Map<
    string,
    { name: string; values: Map<string, { key: string; label: string }> }
  >();

  for (const sku of skus) {
    for (const attr of (sku.attributes ?? []).filter(
      (a) => a.usage === USAGE_DEFINING,
    )) {
      if (!optionMap.has(attr.identifier)) {
        optionMap.set(attr.identifier, { name: attr.name, values: new Map() });
      }
      const option = optionMap.get(attr.identifier);
      if (!option) continue;
      for (const fv of flattenAttributeValues(attr)) {
        option.values.set(fv.key, { key: fv.key, label: fv.label });
      }
    }
  }

  return Array.from(optionMap.entries()).map(([attrId, { name, values }]) => {
    const optionIdentifier = { key: attrId };
    return ProductOptionSchema.parse({
      identifier: optionIdentifier,
      name,
      values: Array.from(values.values()).map((v) =>
        ProductOptionValueSchema.parse({
          identifier: { key: v.key, option: optionIdentifier },
          label: v.label,
        }),
      ),
    });
  });
}

function parseVariant(
  data: HclProductResponse,
  productName: string,
): ProductVariant {
  const images: Image[] = [];
  if (data.fullImage) {
    images.push(
      ImageSchema.parse({ sourceUrl: data.fullImage, altText: productName }),
    );
  }
  if (data.thumbnail && data.thumbnail !== data.fullImage) {
    images.push(
      ImageSchema.parse({ sourceUrl: data.thumbnail, altText: productName }),
    );
  }

  const options = (data.attributes ?? [])
    .filter((attr) => attr.usage === USAGE_DEFINING)
    .flatMap((attr) => {
      const optionIdentifier = { key: attr.identifier };
      return flattenAttributeValues(attr).map((fv) =>
        ProductVariantOptionSchema.parse({
          identifier: optionIdentifier,
          name: attr.name,
          value: {
            identifier: { key: fv.key, option: optionIdentifier },
            label: fv.label,
          },
        }),
      );
    });

  return {
    identifier: { sku: data.partNumber },
    name: data.name || productName,
    images,
    ean: '',
    gtin: '',
    upc: '',
    barcode: '',
    options,
  };
}

export class HclProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  constructor(productSchema: TProductSchema) {
    this.productSchema = productSchema;
  }

  public parseProduct(
    _context: RequestContext,
    data: HclProductResponse,
  ): z.output<TProductSchema> {
    const name = data.name;
    // Derive slug from seo.href (e.g. "/wooden-chair-dr-chrs-0001" → "wooden-chair-dr-chrs-0001").
    // tokenValue is absent in the standard HCL_V2_* detail profiles.
    const slug =
      data.seo?.href?.split('/').filter(Boolean).pop() ??
      data.seo?.tokenValue ??
      data.partNumber;

    const parentCategories = (
      Array.isArray(data.parentCatalogGroupID)
        ? data.parentCatalogGroupID
        : data.parentCatalogGroupID
          ? [data.parentCatalogGroupID]
          : []
    ).map((id) => CategoryIdentifierSchema.parse({ key: id }));

    const sharedAttributes = parseSharedAttributes(data);

    // Determine SKUs: for single-SKU products the product IS the variant
    const skus: HclProductResponse[] =
      !data.hasSingleSKU && data.items?.length > 0 ? data.items : [data];

    const options = parseOptions(skus);

    const mainVariant = parseVariant(skus[0], name);
    const variants = skus.slice(1).map((sku) => parseVariant(sku, name));

    const result = {
      identifier: { key: data.partNumber },
      name,
      slug,
      description: data.shortDescription ?? '',
      longDescription: data.longDescription ?? '',
      brand: data.manufacturer ?? '',
      manufacturer: data.manufacturer ?? '',
      published: data.buyable === 'true',
      parentCategories,
      sharedAttributes,
      options,
      mainVariant,
      variants,
    } satisfies Product;

    return this.productSchema.parse(result);
  }
}
