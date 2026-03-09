import {
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  type AnyProductSchema,
  type Product,
  type ProductFactory,
  type ProductIdentifier,
  type ProductVariant,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  ProductProjection,
  ProductVariant as CTProductVariant,
  Attribute as CTAttribute,
} from '@commercetools/platform-sdk';
import type {
  Image,
  ProductAttribute,
  ProductAttributeIdentifier,
  ProductAttributeValue,
  ProductAttributeValueIdentifier,
  ProductOptionIdentifier,
  ProductVariantOption,

  ProductSchema} from '@reactionary/core';

export class CommercetoolsProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  // PAIN: not being able to assign a default for productSchema (productSchema: TProductSchema = ProductSchema)
  // because it will invalidate TS' conservative instantiation-point generics
  // PAIN: consider whether we can pass in request context here
  constructor(productSchema: TProductSchema) {
    this.productSchema = productSchema;
  }

  public parseProduct(
    context: RequestContext,
    data: ProductProjection,
  ): z.output<TProductSchema> {
    const identifier = { key: data.key || data.id } satisfies ProductIdentifier;
    const name = data.name[context.languageContext.locale];
    const slug = data.slug[context.languageContext.locale];

    let description = '';
    if (data.description) {
      description = data.description[context.languageContext.locale];
    }

    const variantLevelAttributes =
      data.masterVariant.attributes?.map((x) =>
        this.parseAttribute(context, x),
      ) || [];

    const specialAttributes = [
      'reactionaryaccessories',
      'reactionaryspareparts',
      'reactionaryreplacements',
    ];

    const productLevelAttributes =
      data.attributes
        .filter((x) => !specialAttributes.includes(x.name))
        .map((x) => this.parseAttribute(context, x)) || [];

    const sharedAttributes = [
      ...productLevelAttributes,
      ...variantLevelAttributes,
    ];
    const mainVariant = this.parseVariant(context, data.masterVariant, data);

    const otherVariants = [];
    for (const variant of data.variants || []) {
      if (variant.id !== data.masterVariant.id) {
        otherVariants.push(this.parseVariant(context, variant, data));
      }
    }

    const result = {
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
      variants: otherVariants,
    } satisfies Product;

    // PAIN: having to actually do the parse here to guarantee that the generics are satisfied.
    // probably fair, given that this relationship can't be expressed in TS otherwise...
    // unless we were willing to accept ownership of the responsibility and do an 'as T'
    return this.productSchema.parse(result);
  }

  /**
   * Return true, if the attribute is a defining attribute (ie an option)
   * @param attr a variant attribute
   * @returns true if the attribute is an option
   */
  protected isVariantAttributeAnOption(attr: CTAttribute): boolean {
    // for now, the assumption is that any variant attribute is a defining attribute (ie an option)
    // ideally this should be verified with the product type.
    return true;
  }

  protected parseVariant(
    context: RequestContext,
    variant: CTProductVariant,
    product: ProductProjection,
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
        } satisfies Image),
      ),
    ];

    const options =
      (variant.attributes ?? [])
        .filter((attr) => this.isVariantAttributeAnOption(attr))
        .map((attr) => {
          const attrVal = this.parseAttributeValue(context, attr);
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

    const result = {
      identifier,
      images,
      barcode: '',
      ean: '',
      gtin: '',
      name: product.name[context.languageContext.locale],
      options,
      upc: '',
    } satisfies ProductVariant;

    return result;
  }

  protected parseAttribute(
    context: RequestContext,
    attr: CTAttribute,
  ): ProductAttribute {
    const result = ProductAttributeSchema.parse({
      identifier: ProductAttributeIdentifierSchema.parse({
        key: attr.name,
      } satisfies Partial<ProductAttributeIdentifier>),
      group: '',
      name: attr.name,
      values: [this.parseAttributeValue(context, attr)],
    } satisfies Partial<ProductAttribute>);

    return result;
  }

  protected parseAttributeValue(context: RequestContext, attr: CTAttribute): ProductAttributeValue {
    let attrValue = '';
    if (attr.value && Array.isArray(attr.value)) {
      attrValue = attr.value[0];
    }

    if (attr.value && typeof attr.value === 'object') {
      if (context.languageContext.locale in attr.value) {
        attrValue = attr.value[context.languageContext.locale];
      } else {
        attrValue = '-';
      }
    }

    if (typeof attr.value === 'string') {
      attrValue = attr.value;
    }

    const attrVal = ProductAttributeValueSchema.parse({
      identifier: ProductAttributeValueIdentifierSchema.parse({
        key: attrValue,
      } satisfies Partial<ProductAttributeValueIdentifier>),
      value: String(attrValue),
      label: String(attrValue),
    } satisfies Partial<ProductAttributeValue>);

    return attrVal;
  }
}
