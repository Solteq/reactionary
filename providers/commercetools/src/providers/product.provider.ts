import {
  ProductProvider,
  ProductQuery,
  Product,
  RedisCache,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import { z } from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';

export class CommercetoolsProductProvider<Q extends Product> extends ProductProvider<Q>  {
  protected config: CommercetoolsConfiguration;
  protected cache = new RedisCache();

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;
  }

  public async get(query: ProductQuery) {
    const cached = await this.cache.get(query.slug || '');

    console.log(cached);
    
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
            'var.slug': query.slug,
          }
        })
        .execute();

      remote = result.body.results[0];
    }

    const parsed = this.parse(remote);
    const validated = this.validate(parsed);

    this.cache.put(query.slug || '', validated, 60 * 5);

    return validated;
  }

  public override parse(data: any): Q {
    const base = this.base();

    base.identifier.key = data.id;
    base.name = data.name['en-US'];
    base.slug = data.slug['en-US'];

    if (data.description) {
      base.description = data.description['en-US'];
    }

    if (data.masterVariant.images) {
      base.image = data.masterVariant.images[0].url;
    }

    return base;
  }
}
