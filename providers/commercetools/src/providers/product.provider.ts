import {
  ProductProvider
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client.js';
import type { z } from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ProductProjection } from '@commercetools/platform-sdk';
import type { Product, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, RequestContext } from '@reactionary/core';
import type { Cache } from '@reactionary/core';

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
          'var.skus': [payload].map(p => p.sku.key),
        }
      })
      .execute();

    return this.parseSingle(remote.body.results[0], reqCtx);
  }


  protected override parseSingle(dataIn: unknown, reqCtx: RequestContext): T {
    const data = dataIn as ProductProjection;
    const base = this.newModel();


    base.identifier = { key: data.id };
    base.name = data.name[reqCtx.languageContext.locale];
    base.slug = data.slug[reqCtx.languageContext.locale];

    if (data.description) {
      base.description = data.description[reqCtx.languageContext.locale];
    }

    if (data.masterVariant.images && data.masterVariant.images.length > 0) {
      base.image = data.masterVariant.images[0].url;
    }

    base.images = [];
    base.attributes = [];
    base.skus = [];

    const variants = [data.masterVariant, ...data.variants];
    for (const variant of variants) {
      if (variant.sku) {
        base.skus.push({
          identifier: { key: variant.sku },
        });
      }
    }

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier, reqCtx) },
      placeholder: false
    };

    return this.assert(base);
  }



}
