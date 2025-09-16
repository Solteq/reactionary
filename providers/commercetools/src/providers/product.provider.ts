import {
  ProductProvider,
  Product,
  ProductQueryById,
  ProductQueryBySlug,
  Session,
  Cache,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { ProductProjection } from '@commercetools/platform-sdk';

export class CommercetoolsProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public getClient(session: Session) {
    return new CommercetoolsClient(this.config).getClient(session.identity?.token).withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }

  public override async getById(
    payload: ProductQueryById,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    const remote = await client
      .withId({ ID: payload.id })
      .get()
      .execute();

    return this.parseSingle(remote.body, session);
  }

  public override async getBySlug(
    payload: ProductQueryBySlug,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    const remote = await client
      .get({
        queryArgs: {
          where: 'slug(en-US = :slug)',
          'var.slug': payload.slug
        }
      })
      .execute();

    if (remote.body.results.length === 0) {
      throw new Error(`Product with slug '${payload.slug}' not found`);
    }

    return this.parseSingle(remote.body.results[0], session);
  }

  protected override parseSingle(dataIn: unknown, session: Session): T {
    const data = dataIn as ProductProjection;
    const base = this.newModel();

    base.identifier = { key: data.id };
    base.name = data.name[session.languageContext.locale];
    base.slug = data.slug[session.languageContext.locale];

    if (data.description) {
      base.description = data.description[session.languageContext.locale];
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
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier, session) },
      placeholder: false
    };

    return this.assert(base);
  }



}
