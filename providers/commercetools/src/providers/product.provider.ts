import {
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  ProductProvider,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
} from '@reactionary/core';
import type { z } from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  ProductProjection,
  ProductVariant as CTProductVariant,
  Attribute as CTAttribute,
} from '@commercetools/platform-sdk';
import type {
  Product,
  ProductVariant,
  ProductQueryById,
  ProductQueryBySKU,
  ProductQueryBySlug,
  ProductVariantIdentifier,
  RequestContext,
  ProductAttribute,
  ProductAttributeIdentifier,
  ProductAttributeValue,
  ProductAttributeValueIdentifier,
  ProductIdentifier,
  Meta,
  ProductVariantOption,
  ProductOptionIdentifier,
} from '@reactionary/core';
import type { Cache, Image } from '@reactionary/core';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsProductProvider extends ProductProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections();
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
  })
  public override async getById(payload: ProductQueryById): Promise<Product> {
    const client = await this.getClient();

    // FIXME: This should be a ProductIdentifier...
    try {
      const remote = await client
        .withKey({ key: payload.identifier.key })
        .get()
        .execute();

      return this.parseSingle(remote.body);
    } catch (error) {
      return this.createEmptyProduct(payload.identifier.key);
    }
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema.nullable(),
  })
  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<Product | null> {
    const client = await this.getClient();

    const remote = await client
      .get({
        queryArgs: {
          // FIXME: Hardcoded locale
          where: 'slug(en = :slug)',
          'var.slug': payload.slug,
        },
      })
      .execute();

    if (remote.body.count === 0) {
      return null;
    }
    return this.parseSingle(remote.body.results[0]);
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(payload: ProductQueryBySKU): Promise<Product> {
    const client = await this.getClient();

    const remote = await client
      .get({
        queryArgs: {
          staged: false,
          limit: 1,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload].map((p) => p.variant.sku),
        },
      })
      .execute();

    return this.parseSingle(remote.body.results[0]);
  }

  protected parseSingle(data: ProductProjection): Product {
    const identifier = { key: data.key || data.id } satisfies ProductIdentifier;
    const name = data.name[this.context.languageContext.locale];
    const slug = data.slug[this.context.languageContext.locale];

    let description = '';
    if (data.description) {
      description = data.description[this.context.languageContext.locale];
    }

    const variantLevelAttributes =
      data.masterVariant.attributes?.map((x) => this.parseAttribute(x)) || [];
    const productLevelAttributes =
      data.attributes.map((x) => this.parseAttribute(x)) || [];
    const sharedAttributes = [
      ...productLevelAttributes,
      ...variantLevelAttributes,
    ];
    const mainVariant = this.parseVariant(data.masterVariant, data);
    const meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(identifier) },
      placeholder: false,
    } satisfies Meta;

    const result = {
      identifier,
      name,
      slug,
      description,
      sharedAttributes,
      mainVariant,
      meta,
      brand: '',
      longDescription: '',
      manufacturer: '',
      options: [],
      parentCategories: [],
      published: true,
    } satisfies Product;

    return result;
  }

  /**
   * Return true, if the attribute is a defining attribute (ie an option)
   * @param attr a variant attribute
   * @returns true if the attribute is an option
   */
  protected isVariantAttributeAnOption(
    attr: CTAttribute
  ): boolean {
    // for now, the assumption is that any variant attribute is a defining attribute (ie an option)
    // ideally this should be verified with the product type.
    return true;
  }

  protected parseVariant(
    variant: CTProductVariant,
    product: ProductProjection
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

    const options = (variant.attributes ?? []).filter(attr => this.isVariantAttributeAnOption(attr)).map((attr) => {
      const attrVal = this.parseAttributeValue(attr);
      const optionIdentifier: ProductOptionIdentifier = {
        key: attr.name
      }
      const option: ProductVariantOption = {
        identifier: optionIdentifier,
        name: attr.name,
        value: {
          identifier: {
            key: attrVal.value,
            option: optionIdentifier
          },
          label: attrVal.label,
        }
      };
      return option;
    }
    ) || [];

    const result = {
      identifier,
      images,
      barcode: '',
      ean: '',
      gtin: '',
      name: '',
      options,
      upc: ''
    } satisfies ProductVariant;

    return result;
  }

  protected parseAttribute(attr: CTAttribute): ProductAttribute {
    const result = ProductAttributeSchema.parse({
      identifier: ProductAttributeIdentifierSchema.parse({
        key: attr.name,
      } satisfies Partial<ProductAttributeIdentifier>),
      group: '',
      name: attr.name,
      values: [this.parseAttributeValue(attr)],
    } satisfies Partial<ProductAttribute>);

    return result;
  }

  protected parseAttributeValue(attr: CTAttribute): ProductAttributeValue {
    let attrValue = '';
    if (attr.value && Array.isArray(attr.value)) {
      attrValue = attr.value[0];
    }

    if (attr.value && typeof attr.value === 'object') {
      if (this.context.languageContext.locale in attr.value) {
        attrValue = attr.value[this.context.languageContext.locale];
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
