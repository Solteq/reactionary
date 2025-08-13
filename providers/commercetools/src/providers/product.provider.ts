import {
  ProductProvider,
  ProductQuery,
  Product,
  Session,
  BaseMutation,
  ProductMutation,
  SKU,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { ProductProjection } from '@commercetools/platform-sdk';

export class CommercetoolsProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
> extends ProductProvider<T, Q, M> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    querySchema: z.ZodType<Q, Q>,
    mutationSchema: z.ZodType<M, M>
  ) {
    super(schema, querySchema, mutationSchema);

    this.config = config;
  }

  protected override async fetch(
    queries: ProductQuery[],
    session: Session
  ): Promise<T[]> {
    const ids = queries.filter((x) => x.query === 'id').map((x) => x.id);
    const slugs = queries.filter((x) => x.query === 'slug').map((x) => x.slug);

    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
      .get({
        queryArgs: {
          where: 'slug(en-GB in :slugs)',
          'var.slugs': slugs,
          localeProjection: 'en-GB'
        },
      })
      .execute();

    const results = new Array<T>();

    for (const r of remote.body.results) {
      const result = this.parse(r);

      results.push(result);
    }

    return results;
  }

  protected override process(
    mutation: BaseMutation[],
    session: Session
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }

  protected parse(data: ProductProjection): T {
    const base = this.newModel();

    base.identifier.key = data.id;
    base.name = data.name['en-GB'];
    base.slug = data.slug['en-GB'];

    if (data.description) {
      base.description = data.description['en-GB'];
    }

    if (data.masterVariant.images) {
      base.image = data.masterVariant.images[0].url;
    }

    const variants = [data.masterVariant, ...data.variants];
    for (const variant of variants) {
      const sku: SKU = {
        identifier: {
          key: variant.sku || '',
        },
        attributes: [],
        images: [],
      };

      base.skus.push(sku);

      if (variant.attributes) {
        for (const attribute of variant.attributes) {
          sku.attributes.push({
            identifier: {
              key: attribute.name
            },
            name: attribute.name,
            value: attribute.value['en-GB'] || ''
          })
        }
      }

      if (variant.images) {
        for (const image of variant.images) {
          sku.images.push(image.url);
        }
      }
    }

    return base;
  }
}
