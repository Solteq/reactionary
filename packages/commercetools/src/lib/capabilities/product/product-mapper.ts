import {
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  type Image,
  type Product,
  type ProductAttribute,
  type ProductAttributeValue,
  type ProductIdentifier,
  type ProductOptionIdentifier,
  type ProductVariant,
  type ProductVariantIdentifier,
  type ProductVariantOption,
} from '@reactionary/core';
import type {
  Attribute as CTAttribute,
  ProductProjection as CTProductProjection,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';

export function parseCommercetoolsProduct(data: CTProductProjection, locale: string): Product {
  const identifier = { key: data.key || data.id } satisfies ProductIdentifier;
  const name = data.name[locale] ?? '';
  const slug = data.slug[locale] ?? '';

  const description = data.description?.[locale] ?? '';

  const variantLevelAttributes =
    data.masterVariant.attributes?.map((x) => parseCommercetoolsProductAttribute(x, locale)) || [];
  const productLevelAttributes =
    data.attributes.map((x) => parseCommercetoolsProductAttribute(x, locale)) || [];
  const sharedAttributes = [
    ...productLevelAttributes,
    ...variantLevelAttributes,
  ];
  const mainVariant = parseCommercetoolsProductVariant(data.masterVariant, data, locale);

  const variants = [];
  for (const variant of data.variants || []) {
    if (variant.id !== data.masterVariant.id) {
      variants.push(parseCommercetoolsProductVariant(variant, data, locale));
    }
  }

  return {
    identifier,
    name,
    slug,
    description,
    sharedAttributes,
    mainVariant,
    brand: '',
    longDescription: '',
    manufacturer: '',
    options: [],
    parentCategories: [],
    published: true,
    variants,
  } satisfies Product;
}

function isVariantAttributeAnOption(_attr: CTAttribute): boolean {
  return true;
}

export function parseCommercetoolsProductVariant(
  variant: CTProductVariant,
  product: CTProductProjection,
  locale: string,
): ProductVariant {
  const identifier = {
    sku: variant.sku!,
  } satisfies ProductVariantIdentifier;

  const images = [
    ...(variant.images || []).map((img) =>
      ImageSchema.parse({
        sourceUrl: img.url,
        altText: img.label || '',
        width: img.dimensions?.w,
        height: img.dimensions?.h,
      } satisfies Image)
    ),
  ];

  const options =
    (variant.attributes ?? [])
      .filter((attr) => isVariantAttributeAnOption(attr))
      .map((attr) => {
        const attrVal = parseCommercetoolsProductAttributeValue(attr, locale);
        const optionIdentifier: ProductOptionIdentifier = {
          key: attr.name,
        };
        const option: ProductVariantOption = {
          identifier: optionIdentifier,
          name: attr.name,
          value: {
            identifier: {
              key: attrVal.value,
              option: optionIdentifier,
            },
            label: attrVal.label,
          },
        };
        return option;
      }) || [];

  return {
    identifier,
    images,
    barcode: '',
    ean: '',
    gtin: '',
    name: product.name[locale] ?? '',
    options,
    upc: '',
  } satisfies ProductVariant;
}

export function parseCommercetoolsProductAttribute(attr: CTAttribute, locale: string): ProductAttribute {
  return ProductAttributeSchema.parse({
    identifier: ProductAttributeIdentifierSchema.parse({
      key: attr.name,
    }),
    group: '',
    name: attr.name,
    values: [parseCommercetoolsProductAttributeValue(attr, locale)],
  } satisfies Partial<ProductAttribute>);
}

export function parseCommercetoolsProductAttributeValue(attr: CTAttribute, locale: string): ProductAttributeValue {
  let attrValue = '';
  if (attr.value && Array.isArray(attr.value)) {
    attrValue = attr.value[0];
  }

  if (attr.value && typeof attr.value === 'object') {
    if (locale in attr.value) {
      attrValue = attr.value[locale];
    } else {
      attrValue = '-';
    }
  }

  if (typeof attr.value === 'string') {
    attrValue = attr.value;
  }

  return ProductAttributeValueSchema.parse({
    identifier: ProductAttributeValueIdentifierSchema.parse({
      key: attrValue,
    }),
    value: String(attrValue),
    label: String(attrValue),
  } satisfies Partial<ProductAttributeValue>);
}
