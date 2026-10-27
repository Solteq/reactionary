import type {
  StoreProduct,
  StoreProductImage,
  StoreProductVariant,
} from '@medusajs/types';
import {
  CategoryIdentifierSchema,
  ProductIdentifierSchema,
  type AnyProductSchema,
  type Image,
  type Product,
  type ProductComplianceData,
  type ProductTerm,
  type ProductType,
  type ProductAttribute,
  type ProductAttributeIdentifier,
  type ProductAttributeValueIdentifier,
  type ProductFactory,
  type ProductOptionIdentifier,
  type ProductOptionValueIdentifier,
  type ProductSchema,
  type ProductVariant,
  type ProductVariantOption,
  type RequestContext,
  ProductComplianceDataSchema,
} from '@reactionary/core';
import type * as z from 'zod';
import createDebug from 'debug';
import { safeStringConvert } from '../../utils/medusa-helpers.js';
import { parseProductSearchComplianceData } from '../../utils/product-compliance.js';
import {
  parseAttributeDefinitions,
  parseFlags,
  parseTagAsTerm,
  pickLocalized,
  pickMetadataName,
  type MedusaAttributeDefinition,
} from '../../utils/taxonomy.js';

const debug = createDebug('reactionary:medusa:product');


export class MedusaProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  constructor(productSchema: TProductSchema) {
    this.productSchema = productSchema;
  }

  protected parseVariant(
    _context: RequestContext,
    variant: StoreProductVariant,
    product: StoreProduct,
  ) {
    const options = (variant.options ?? []).map((option) => {
      const optionId: ProductOptionIdentifier = { key: option.option_id || '' };
      const title = option.option?.title || '?';
      const valueIdentifier: ProductOptionValueIdentifier = {
        key: option.option_id || '',
        option: optionId,
      };
      const value = option.value || '';

      const result: ProductVariantOption = {
        identifier: optionId,
        name: title,
        value: {
          identifier: valueIdentifier,
          label: value,
        },
      };
      return result;
    });

    const result: ProductVariant = {
      identifier: {
        sku: variant.sku || '',
      },
      name: variant.title || product.title,
      upc: variant.upc || '',
      ean: variant.ean || '',

      images: (product.images || []).map((img: StoreProductImage) => {
        return {
          sourceUrl: img.url,
          altText: variant.title || product.title || '',
        } satisfies Image;
      }),
      options: options,
      gtin: variant.ean || '',
      barcode: variant.ean || '',
    };

    return result;
  }

  protected createSynthAttribute(
    key: string,
    name: string,
    value: string,
  ): ProductAttribute {
    const attributeIdentifier: ProductAttributeIdentifier = { key };
    const valueIdentifier: ProductAttributeValueIdentifier = {
      key: `${key}-${value}`,
    };

    const attribute: ProductAttribute = {
      identifier: attributeIdentifier,
      name,
      group: '',
      values: [
        {
          identifier: valueIdentifier,
          label: String(value),
          value: value,
        },
      ],
    };
    return attribute;
  }

  /**
   * Builds an attribute from its definition on the product type. The label, group and unit are
   * taken in the request locale, the label falls back to the raw key.
   */
  protected createDefinedAttribute(
    context: RequestContext,
    definition: MedusaAttributeDefinition,
    value: string,
  ): ProductAttribute {
    const locale = context.languageContext.locale;
    const attribute = this.createSynthAttribute(
      definition.key,
      pickLocalized(definition.names, locale) ?? definition.key,
      value,
    );
    attribute.group = pickLocalized(definition.groups, locale) ?? '';
    const unit = pickLocalized(definition.unit, locale);
    if (unit) {
      attribute.unit = unit;
    }
    if (definition.data_type) {
      attribute.dataType = definition.data_type;
    }
    return attribute;
  }

  protected parseAttributes(
    _context: RequestContext,
    _body: StoreProduct,
  ): Array<ProductAttribute> {
    const sharedAttributes: ProductAttribute[] = [];

    if (_body.origin_country) {
      sharedAttributes.push(
        this.createSynthAttribute(
          'origin_country',
          'Origin Country',
          _body.origin_country,
        ),
      );
    }

    if (_body.height) {
      sharedAttributes.push(
        this.createSynthAttribute('height', 'Height', String(_body.height)),
      );
    }

    if (_body.weight) {
      sharedAttributes.push(
        this.createSynthAttribute('weight', 'Weight', String(_body.weight)),
      );
    }

    if (_body.length) {
      sharedAttributes.push(
        this.createSynthAttribute('length', 'Length', String(_body.length)),
      );
    }

    if (_body.width) {
      sharedAttributes.push(
        this.createSynthAttribute('width', 'Width', String(_body.width)),
      );
    }

    if (_body.material) {
      sharedAttributes.push(
        this.createSynthAttribute('material', 'Material', _body.material),
      );
    }
    if (_body.metadata) {
      const keysToExclude = [
        'reactionaryaccessories',
        'reactionaryreplacements',
        'reactionaryspareparts',
        // the flag list is mapped to Product.flags
        'flags',
      ];
      const definitions = parseAttributeDefinitions(
        _body.type?.metadata?.['attribute_definitions'],
      );
      const synthCount = sharedAttributes.length;
      const defined: Array<{ order: number; attribute: ProductAttribute }> = [];
      for (const [key, value] of Object.entries(_body.metadata)) {
        if (keysToExclude.includes(key)) {
          continue;
        }
        if (key.startsWith('compliance_data')) {
          continue;
        }
        const definition = definitions.get(key);
        if (definition) {
          defined.push({
            order: definition.order,
            attribute: this.createDefinedAttribute(_context, definition, String(value)),
          });
          continue;
        }
        sharedAttributes.push(
          this.createSynthAttribute(key, key, String(value)),
        );
      }
      // Array.sort is stable, so equal order values keep the metadata order
      defined.sort((a, b) => a.order - b.order);
      sharedAttributes.splice(synthCount, 0, ...defined.map((entry) => entry.attribute));
    }
    return sharedAttributes;
  }


  public parseComplianceData(
    context: RequestContext,
    body: StoreProduct,
  ): ProductComplianceData {
    if (!body.metadata) {
      return ProductComplianceDataSchema.parse({});
    }

    const shared = parseProductSearchComplianceData(body);
    const complianceData = {
      ce_marking: shared.ce_marking,
      weee_symbol: shared.weee_symbol,
      energy_class: shared.energy_class,
      energy_class_range: shared.energy_class_range,
      garan_duration: shared.garan_duration,
      eprel_registration_number: shared.eprel_registration_number,
      eprel_product_group: shared.eprel_product_group,

      safety_warnings: safeStringConvert(body.metadata?.['compliance_data_safety_warnings']),
      composition: safeStringConvert(body.metadata?.['compliance_data_composition']),
      additional_disclosures: safeStringConvert(body.metadata?.['compliance_data_additional_disclosures']),

      organic: {
        is_organic: shared.is_organic ?? false,
        certification_type: shared.organic_certification_type,
        control_body_code: safeStringConvert(body.metadata?.['compliance_data_organic_control_body_code']),
        agriculture_origin: safeStringConvert(body.metadata?.['compliance_data_organic_agriculture_origin']),
        certificate_url: safeStringConvert(body.metadata?.['compliance_data_organic_certificate_url']),
      },
      traceability: {
        product_identifier: safeStringConvert(body.metadata?.['compliance_data_traceability_product_identifier']),
        manufacturer: {
          name: safeStringConvert(body.metadata?.['compliance_data_traceability_manufacturer_name']),
          postal_address: safeStringConvert(body.metadata?.['compliance_data_traceability_manufacturer_postal_address']),
          electronic_address: safeStringConvert(body.metadata?.['compliance_data_traceability_manufacturer_electronic_address']),
        },
        eu_responsible_person: {
          name: safeStringConvert(body.metadata?.['compliance_data_traceability_eu_responsible_person_name']),
          postal_address: safeStringConvert(body.metadata?.['compliance_data_traceability_eu_responsible_person_postal_address']),
          electronic_address: safeStringConvert(body.metadata?.['compliance_data_traceability_eu_responsible_person_electronic_address']),
        },
      },
    } satisfies ProductComplianceData;

    return complianceData;
  }

  protected parseProductType(
    context: RequestContext,
    data: StoreProduct,
  ): ProductType | undefined {
    const type = data.type;
    if (!type) {
      return undefined;
    }
    const key = type.external_id || type.id;
    if (!key) {
      return undefined;
    }
    return {
      identifier: { key },
      // the localized names are in the metadata, the value is the English name, translated by Medusa when it can
      name: pickMetadataName(type.metadata, context.languageContext.locale) || type.value || key,
    };
  }

  protected parseTerms(
    context: RequestContext,
    data: StoreProduct,
  ): ProductTerm[] {
    const terms: ProductTerm[] = [];
    for (const tag of data.tags ?? []) {
      const term = parseTagAsTerm(tag, context.languageContext.locale);
      if (term) {
        terms.push(term);
      }
    }
    return terms;
  }

  public parseProduct(
    context: RequestContext,
    data: StoreProduct,
  ): z.output<TProductSchema> {
    const identifier = ProductIdentifierSchema.parse({
      key: data.external_id || data.id,
    });
    const name = data.title;
    const slug = data.handle;
    const description = data.description || '' || data.subtitle || '';
    const parentCategories = [];
    parentCategories.push(
      ...(data.categories
        ?.map((cat) => cat.external_id)
        .map((id) => CategoryIdentifierSchema.parse({ key: id || '' })) || []),
    );
    const sharedAttributes = this.parseAttributes(context, data);


    const complianceData = this.parseComplianceData(context, data);
    const productType = this.parseProductType(context, data);
    const terms = this.parseTerms(context, data);
    const flags = parseFlags(data.metadata?.['flags']);

    if (!data.variants) {
      debug('Product has no variants', data);
      throw new Error('Product has no variants ' + data.external_id);
    }
    const mainVariant = this.parseVariant(context, data.variants[0], data);

    const otherVariants = [];
    if (data.variants.length > 1) {
      otherVariants.push(
        ...data.variants
          .slice(1)
          .map((variant) => this.parseVariant(context, variant, data)),
      );
    }

    const result = {
      brand: '',
      description,
      identifier,
      longDescription: '',
      mainVariant,
      manufacturer: '',
      name,
      options: [],
      parentCategories,
      published: true,
      sharedAttributes,
      slug,
      variants: otherVariants,
      complianceData: complianceData,
      productType,
      terms,
      flags,
    } satisfies Product;

    return this.productSchema.parse(result);
  }
}
