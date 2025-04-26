import {
  ProductProvider,
  ProductSchema,
  ProductQuery,
} from '@reactionary/core';
import { CommercetoolsConfig } from '../core/configuration';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';

export class CommercetoolsProductProvider<
  T extends z.ZodTypeAny
> extends ProductProvider<T> {
  protected config: CommercetoolsConfig;

  constructor(config: CommercetoolsConfig, schema: T) {
    super(schema);

    this.config = config;
  }

  public async get(query: ProductQuery) {
    const result = ProductSchema.parse({});
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    let remote;

    if (query.id) {
      const result = await client
        .withProjectKey({ projectKey: this.config.projectKey })
        .productProjections()
        .withId({
          ID: query.id,
        })
        .get()
        .execute();

        remote = result.body;
    } else {
      const result = await client
        .withProjectKey({ projectKey: this.config.projectKey })
        .productProjections()
        .get({
          queryArgs: {
            where: 'slug(en-US=:slug)',
            'var.slug': query.slug
          }
        })
        .execute();

      remote = result.body.results[0];
    }

    result.identifier.id = remote.id;
    result.name = remote.name['en-US'];

    console.log('result: ', remote);

    if (remote.description) {
      result.description = remote.description['en-US'];
    }

    if (remote.masterVariant.images) {
      result.image = remote.masterVariant.images[0].url;
    }

    return this.schema.parse(result);
  }
}
