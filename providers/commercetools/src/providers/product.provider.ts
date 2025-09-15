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

  public override async getById(
    payload: ProductQueryById,
    _session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
      .withId({ ID: payload.id })
      .get()
      .execute();

    return this.parse(remote.body);
  }

  public override async getBySlug(
    payload: ProductQueryBySlug,
    _session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
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

    return this.parse(remote.body.results[0]);
  }

  protected parse(data: ProductProjection): T {
    const base = this.newModel();

    base.identifier = { key: data.id };
    base.name = data.name['en-US'];
    base.slug = data.slug['en-US'];

    if (data.description) {
      base.description = data.description['en-US'];
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
      cache: { hit: false, key: data.id },
      placeholder: false
    };

    return this.assert(base);
  }
}
