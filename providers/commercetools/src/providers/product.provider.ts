import {
  ImageSchema,
  ProductAttributeIdentifierSchema,
  ProductAttributeSchema,
  ProductAttributeValueIdentifierSchema,
  ProductAttributeValueSchema,
  ProductProvider,
  ProductVariantIdentifierSchema,
  ProductVariantSchema
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client.js';
import type { z } from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ProductProjection, ProductVariant as CTProductVariant, Attribute as CTAttribute } from '@commercetools/platform-sdk';
import type { Product, ProductVariant, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, ProductVariantIdentifier, RequestContext, ProductAttribute, ProductAttributeIdentifier, ProductAttributeValue, ProductAttributeValueIdentifier } from '@reactionary/core';
import type { Cache, Image } from '@reactionary/core';

export class CommercetoolsProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }

  protected async getClient() {
    const client = await new CommercetoolsClient(this.config).getClient(this.context);
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }

  public override async getById(
    payload: ProductQueryById
  ): Promise<T> {
    const client = await this.getClient();

    try {
      const remote = await client
        .withId({ ID: payload.id })
        .get()
        .execute();

      return this.parseSingle(remote.body);
    } catch(error) {
      return this.createEmptyProduct(payload.id);
    }
  }

  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<T | null> {
    const client = await this.getClient();

    const remote = await client
      .get({
        queryArgs: {
          where: 'slug(en-US = :slug)',
          'var.slug': payload.slug
        }
      })
      .execute();

    if (remote.body.count === 0) {
      return null;
    }
    return this.parseSingle(remote.body.results[0]);
  }

  public override async getBySKU(
    payload: ProductQueryBySKU
  ): Promise<T> {
    const client = await this.getClient();

    const remote = await client
      .get({
        queryArgs: {
          staged: false,
          limit: 1,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload].map(p => p.variant.sku),
        }
      })
      .execute();

    return this.parseSingle(remote.body.results[0]);
  }


  protected override parseSingle(data: ProductProjection): T {

    const base = this.newModel();


    base.identifier = { key: data.id };
    base.name = data.name[this.context.languageContext.locale];
    base.slug = data.slug[this.context.languageContext.locale];

    if (data.description) {
      base.description = data.description[this.context.languageContext.locale];
    }


    base.sharedAttributes = data.masterVariant.attributes?.map(x => this.parseAttribute(x)) || [];
    base.mainVariant = this.parseVariant(data.masterVariant, data);

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier) },
      placeholder: false
    };

    return this.assert(base);
  }

  protected parseVariant(variant: CTProductVariant, product: ProductProjection): ProductVariant {
    const result = ProductVariantSchema.parse({
      identifier: ProductVariantIdentifierSchema.parse({
        sku: variant.sku
      } satisfies Partial<ProductVariantIdentifier>),

      images: [
        ...(variant.images || []).map(img => ImageSchema.parse({
          sourceUrl: img.url,
          altText: img.label || '',
          width: img.dimensions?.w,
          height: img.dimensions?.h,
        } satisfies Partial<Image>))
     ],
    } satisfies Partial<ProductVariant>);
    return result;
  }

  protected parseAttribute(attr: CTAttribute): ProductAttribute {
    const result  = ProductAttributeSchema.parse({
      identifier: ProductAttributeIdentifierSchema.parse({
        key: attr.name
      } satisfies Partial< ProductAttributeIdentifier>),
      group: '',
      name: attr.name,
      values: [
        this.parseAttributeValue(attr)
      ]
    } satisfies Partial< ProductAttribute >);

    return result;
  };

  protected parseAttributeValue(attr: CTAttribute): ProductAttributeValue {

    let attrValue = '';
    if (attr.value && Array.isArray(attr.value)) {
      attrValue = attr.value[0];
    }

    if (attrValue && typeof attrValue === 'object') {
      if (this.context.languageContext.locale in attrValue) {
        attrValue = attrValue[this.context.languageContext.locale];
      } else  {
        attrValue = '-';
      }
    }

    const attrVal =  ProductAttributeValueSchema.parse({
      identifier: ProductAttributeValueIdentifierSchema.parse({
        key: attrValue
      } satisfies Partial< ProductAttributeValueIdentifier>),
      value: String(attrValue),
      label: String(attrValue)
    } satisfies Partial< ProductAttributeValue >);

    return attrVal;
  }

}
