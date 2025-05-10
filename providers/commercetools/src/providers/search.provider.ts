import {
  SearchIdentifier,
  SearchProvider,
  SearchResult,
  SearchResultProductSchema,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';

export class CommercetoolsSearchProvider<
  T extends SearchResult
> extends SearchProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>) {
    super(schema);

    this.config = config;
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
      .search()
      .get({
        queryArgs: {
          limit: identifier.pageSize,
          offset: identifier.pageSize * identifier.page,
          ['text.en-US']: identifier.term,
        },
      })
      .execute();

    const parsed = this.parse(remote, identifier);
    const validated = this.validate(parsed);

    return validated;
  }

  public override parse(remote: any, query: SearchIdentifier): T {
    const result = super.base();

    result.identifier = query;

    for (const p of remote.body.results) {
      const product = SearchResultProductSchema.parse({});

      product.identifier.key = p.id;
      product.name = p.name['en-US'];

      if (p.masterVariant.images) {
        product.image = p.masterVariant.images[0].url;
      }

      result.products.push(product);
    }

    result.pages = Math.ceil((remote.body.total || 0) / query.pageSize);

    return result;
  }
}
