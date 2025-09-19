import {
  ProductProvider,
  Product,
  Cache,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { ProductProjection } from '@commercetools/platform-sdk';
import { traced } from '@reactionary/otel';
import type { ProductQueryById, ProductQueryBySlug, Session } from '@reactionary/core';

export class CommercetoolsProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected getClient(session: Session) {
    const token = session.identity.keyring.find(x => x.service === 'commercetools')?.token;
    const client = new CommercetoolsClient(this.config).getClient(
      token
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }

  @traced()
  public override async getById(
    payload: ProductQueryById,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    try {
      const remote = await client
        .withId({ ID: payload.id })
        .get()
        .execute();

      return this.parseSingle(remote.body, session);
    } catch(error) {
      return this.createEmptyProduct(payload.id);
    }
  }

  @traced()
  public override async getBySlug(
    payload: ProductQueryBySlug,
    session: Session
  ): Promise<T | null> {
    const client = this.getClient(session);

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
