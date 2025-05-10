import {
  ProductProvider,
  ProductSchema,
  ProductQuery,
  Product,
  InMemoryCache,
} from '@reactionary/core';
import { CommercetoolsConfig } from '../core/configuration';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';

export class CommercetoolsProductProvider<Q extends Product> extends ProductProvider<Q>  {
  protected config: CommercetoolsConfig;
  protected cache = new InMemoryCache(1000, 60 * 1000);

  constructor(config: CommercetoolsConfig, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;

    console.log('REBUILD?!');
  }

  public async get(query: ProductQuery) {
    const cached = this.cache.get(query.slug || '');
    console.log(cached);

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

    result.identifier.key = remote.id;
    result.name = remote.name['en-US'];
    result.slug = remote.slug['en-US'];

    if (remote.description) {
      result.description = remote.description['en-US'];
    }

    if (remote.masterVariant.images) {
      result.image = remote.masterVariant.images[0].url;
    }

    const response = this.schema.parse(result);

    this.cache.put(query.slug || '', response);

    return response;
  }
}
