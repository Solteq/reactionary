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
    const cacheKey = query.slug || '';

    // TODO: Find a better method for type-safety from cache
    let result = await this.cache.get(cacheKey) as Q;

    const cacheHit = !!result;
    
    if (!cacheHit) {
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

      result = this.parse(remote);
    }

    result.meta.cache.key = cacheKey;
    result.meta.cache.hit = cacheHit;

    const validated = this.validate(result);

    this.cache.put(cacheKey, validated, 60 * 5);

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
