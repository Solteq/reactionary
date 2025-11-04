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
import type { ProductProjection, ProductVariant as CTProductVariant, AttributeLocalizableTextType, Attribute as CTAttribute } from '@commercetools/platform-sdk';
import type { Product, ProductVariant, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, ProductVariantIdentifier, RequestContext, ProductAttribute, ProductAttributeIdentifier, ProductAttributeValue, ProductAttributeValueIdentifier } from '@reactionary/core';
import type { Cache, Image } from '@reactionary/core';

export class CommercetoolsProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {

    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }

  public override async getById(
    payload: ProductQueryById,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);

    try {
      const remote = await client
        .withId({ ID: payload.id })
        .get()
        .execute();

      return this.parseSingle(remote.body, reqCtx);
    } catch(error) {
      return this.createEmptyProduct(payload.id);
    }
  }

  public override async getBySlug(
    payload: ProductQueryBySlug,
    reqCtx: RequestContext
  ): Promise<T | null> {
    const client = await this.getClient(reqCtx);

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
    return this.parseSingle(remote.body.results[0], reqCtx);
  }

  public override async getBySKU(
    payload: ProductQueryBySKU,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);

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

    return this.parseSingle(remote.body.results[0], reqCtx);
  }


  protected override parseSingle(data: ProductProjection, reqCtx: RequestContext): T {

    const base = this.newModel();


    base.identifier = { key: data.id };
    base.name = data.name[reqCtx.languageContext.locale];
    base.slug = data.slug[reqCtx.languageContext.locale];

    if (data.description) {
      base.description = data.description[reqCtx.languageContext.locale];
    }


    base.sharedAttributes = data.masterVariant.attributes?.map(x => this.parseAttribute(x, reqCtx)) || [];
    base.mainVariant = this.parseVariant(data.masterVariant, data, reqCtx);

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier, reqCtx) },
      placeholder: false
    };

    return this.assert(base);
  }

  protected parseVariant(variant: CTProductVariant, product: ProductProjection, reqCtx: RequestContext): ProductVariant {
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

  protected parseAttribute(attr: CTAttribute, reqCtx: RequestContext): ProductAttribute {
    const result  = ProductAttributeSchema.parse({
      identifier: ProductAttributeIdentifierSchema.parse({
        key: attr.name
      } satisfies Partial< ProductAttributeIdentifier>),
      group: '',
      name: attr.name,
      values: [
        this.parseAttributeValue(attr, reqCtx)
      ]
    } satisfies Partial< ProductAttribute >);

    return result;
  };

  protected parseAttributeValue(attr: CTAttribute, reqCtx: RequestContext): ProductAttributeValue {

    let attrValue = '';
    if (attr.value && Array.isArray(attr.value)) {
      attrValue = attr.value[0];
    }

    if (attrValue && typeof attrValue === 'object') {
      if (reqCtx.languageContext.locale in attrValue) {
        attrValue = attrValue[reqCtx.languageContext.locale];
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
