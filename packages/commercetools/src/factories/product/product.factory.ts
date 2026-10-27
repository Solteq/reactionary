import {
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  ProductComplianceDataSchema,
  ProductFlagSchema,
  type AnyProductSchema,
  type Product,
  type ProductFactory,
  type ProductIdentifier,
  type ProductVariant,
  type ProductConcept,
  type ProductType,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  ProductProjection,
  ProductVariant as CTProductVariant,
  ProductType as CTProductType,
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

  ProductSchema,
  ProductComplianceData} from '@reactionary/core';
import { getLanguageCodeFromLocale } from '../../core/locale-utils.js';
import { getAttributeValueKeyAndLabel } from '../../core/attribute-utils.js';

/**
 * The product types that recalcitrant manages are keyed rc-<typeID>.
 */
const MANAGED_PRODUCT_TYPE_KEY_PREFIX = 'rc-';
/**
 * Taxonomy concepts are carried by attributes named concept_<vocabulary>.
 */
const CONCEPT_ATTRIBUTE_PREFIX = 'concept_';
const FLAGS_ATTRIBUTE = 'flags';

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
    const localeStr = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    const name = data.name[localeStr];
    const slug = data.slug[localeStr];

    let description = '';
    if (data.description) {
      description = data.description[localeStr];
    }

    const productType = data.productType?.obj;

    const variantLevelAttributes = data.masterVariant.attributes ?? [];

    const specialAttributes = [
      'reactionaryaccessories',
      'reactionaryspareparts',
      'reactionaryreplacements',
    ];

    const productLevelAttributes = (data.attributes ?? []).filter(
      (x) => !specialAttributes.includes(x.name),
    );

    const allAttributes = [...productLevelAttributes, ...variantLevelAttributes];
    // only the product types that recalcitrant manages get the taxonomy handling, everything else maps as it always did
    const managed = this.isManagedProductType(productType);
    const sharedAttributes = allAttributes
      .filter((x) => !managed || !this.isTaxonomyAttribute(x))
      .map((x) => this.parseAttribute(context, x, productType))
      .filter((x) => !managed || x.values.length > 0);
    const concepts = managed ? this.parseConcepts(context, allAttributes) : [];
    const flags = managed ? this.parseFlags(allAttributes) : [];

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
      complianceData: this.parseComplianceData(context, data),
      productType: managed ? this.parseProductType(productType) : undefined,
      concepts,
      flags,
    } satisfies Product;

    // PAIN: having to actually do the parse here to guarantee that the generics are satisfied.
    // probably fair, given that this relationship can't be expressed in TS otherwise...
    // unless we were willing to accept ownership of the responsibility and do an 'as T'
    return this.productSchema.parse(result);
  }

  /**
   * Whether the product type is one that recalcitrant manages (key rc-<typeID>). Labels, taxonomy attributes
   * and the stricter value parsing only apply to those, other product types map as they did before.
   */
  protected isManagedProductType(productType: CTProductType | undefined): boolean {
    return productType?.key?.startsWith(MANAGED_PRODUCT_TYPE_KEY_PREFIX) ?? false;
  }

  protected parseProductType(productType: CTProductType | undefined): ProductType | undefined {
    if (!productType) {
      return undefined;
    }
    const key = productType.key ?? productType.id;
    return {
      identifier: {
        key: key.startsWith(MANAGED_PRODUCT_TYPE_KEY_PREFIX) ? key.slice(MANAGED_PRODUCT_TYPE_KEY_PREFIX.length) : key,
      },
      name: productType.name,
    };
  }

  /**
   * The concept_<vocabulary> and flags attributes carry taxonomy data, they are no product attributes.
   */
  protected isTaxonomyAttribute(attr: CTAttribute): boolean {
    return attr.name === FLAGS_ATTRIBUTE || attr.name.startsWith(CONCEPT_ATTRIBUTE_PREFIX);
  }

  /**
   * Maps the concept_<vocabulary> attributes (sets of enums) to concepts. The enum key is the concept id with
   * the first '/' encoded as '__', and the enum label holds the localized names.
   */
  protected parseConcepts(context: RequestContext, attributes: CTAttribute[]): ProductConcept[] {
    const language = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    const concepts: ProductConcept[] = [];
    for (const attr of attributes) {
      if (!attr.name.startsWith(CONCEPT_ATTRIBUTE_PREFIX)) {
        continue;
      }
      const attributeVocabulary = attr.name.slice(CONCEPT_ATTRIBUTE_PREFIX.length);
      const entries: unknown[] = Array.isArray(attr.value) ? attr.value : [attr.value];
      for (const entry of entries) {
        const { key, label } = getAttributeValueKeyAndLabel(entry, language);
        if (!key) {
          continue;
        }
        const id = key.replace('__', '/');
        if (concepts.some((concept) => concept.identifier.key === id)) {
          continue;
        }
        const separator = id.indexOf('/');
        concepts.push({
          identifier: { key: id },
          vocabulary: separator > 0 ? id.slice(0, separator) : attributeVocabulary,
          name: label || (separator >= 0 ? id.slice(separator + 1) : id),
        });
      }
    }
    return concepts;
  }

  /**
   * Maps the flags attribute (set of enum) to the closed list of flags, dropping unknown keys.
   */
  protected parseFlags(attributes: CTAttribute[]): string[] {
    const flags: string[] = [];
    for (const attr of attributes) {
      if (attr.name !== FLAGS_ATTRIBUTE) {
        continue;
      }
      const entries: unknown[] = Array.isArray(attr.value) ? attr.value : [attr.value];
      for (const entry of entries) {
        const parsed = ProductFlagSchema.safeParse(getAttributeValueKeyAndLabel(entry, 'en').key);
        if (parsed.success && !flags.includes(parsed.data)) {
          flags.push(parsed.data);
        }
      }
    }
    return flags;
  }

  protected parseComplianceData(context: RequestContext, data: ProductProjection): ProductComplianceData {
    return ProductComplianceDataSchema.parse({});
  }

  /**
   * Return true, if the attribute is a defining attribute (ie an option)
   * @param attr a variant attribute
   * @returns true if the attribute is an option
   */
  protected isVariantAttributeAnOption(attr: CTAttribute, productType?: CTProductType): boolean {
    if (!this.isManagedProductType(productType)) {
      return true;
    }
    // taxonomy attributes and attributes that are the same for all variants describe the product, not a variant
    if (this.isTaxonomyAttribute(attr)) {
      return false;
    }
    const definition = productType?.attributes?.find((x) => x.name === attr.name);
    if (definition?.attributeConstraint === 'SameForAll') {
      return false;
    }
    // otherwise the assumption is that any variant attribute is a defining attribute (ie an option)
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
    const localeStr = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
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
        .filter((attr) => this.isVariantAttributeAnOption(attr, product.productType?.obj))
        .map((attr) => {
          const attrVal = this.isManagedProductType(product.productType?.obj)
            ? this.parseManagedAttributeValue(context, attr)
            : this.parseAttributeValue(context, attr);
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
      name: product.name[localeStr],
      options,
      upc: '',
    } satisfies ProductVariant;

    return result;
  }

  /**
   * Picks the label of an attribute from the product type definition for the request locale,
   * falling back to en, any label, and finally the machine name of the attribute.
   */
  protected parseAttributeName(
    context: RequestContext,
    attr: CTAttribute,
    productType?: CTProductType,
  ): string {
    const label = productType?.attributes?.find((x) => x.name === attr.name)?.label;
    if (!label) {
      return attr.name;
    }
    const language = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    return label[language] || label['en'] || Object.values(label).find((x) => !!x) || attr.name;
  }

  protected parseAttribute(
    context: RequestContext,
    attr: CTAttribute,
    productType?: CTProductType,
  ): ProductAttribute {
    if (!this.isManagedProductType(productType)) {
      return ProductAttributeSchema.parse({
        identifier: ProductAttributeIdentifierSchema.parse({
          key: attr.name,
        } satisfies Partial<ProductAttributeIdentifier>),
        group: '',
        name: attr.name,
        values: [this.parseAttributeValue(context, attr)],
      } satisfies Partial<ProductAttribute>);
    }

    // sets carry one value per entry
    const entries: unknown[] = Array.isArray(attr.value) ? attr.value : [attr.value];
    const values = entries.map((entry) =>
      this.parseManagedAttributeValue(context, { name: attr.name, value: entry }),
    );

    return ProductAttributeSchema.parse({
      identifier: ProductAttributeIdentifierSchema.parse({
        key: attr.name,
      } satisfies Partial<ProductAttributeIdentifier>),
      group: '',
      name: this.parseAttributeName(context, attr, productType),
      values,
    } satisfies Partial<ProductAttribute>);
  }

  protected parseAttributeValue(context: RequestContext, attr: CTAttribute): ProductAttributeValue {
    let attrValue = '';
    if (attr.value && Array.isArray(attr.value)) {
      attrValue = attr.value[0];
    }
    const localeStr = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    if (attr.value && typeof attr.value === 'object') {
      if (localeStr in attr.value) {
        attrValue = attr.value[localeStr];
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

  /**
   * Parses the value of an attribute of a managed product type: plain values, localized text and (localized)
   * enums, by key and label, with any translation as the fallback.
   */
  protected parseManagedAttributeValue(context: RequestContext, attr: CTAttribute): ProductAttributeValue {
    const language = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    const { key, label } = getAttributeValueKeyAndLabel(attr.value, language);

    return ProductAttributeValueSchema.parse({
      identifier: ProductAttributeValueIdentifierSchema.parse({
        key,
      } satisfies Partial<ProductAttributeValueIdentifier>),
      value: key,
      label,
    } satisfies Partial<ProductAttributeValue>);
  }
}
