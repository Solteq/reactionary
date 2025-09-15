import {
  SearchProvider,
  SearchQueryByTerm,
  SearchResult,
  SearchResultProduct,
  Session,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';

export class CommercetoolsSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = [];

    for (const query of queries) {
      const result = await this.get(query.search);

      results.push(result);
    }

    return results;
  }

  protected override process(mutations: M[], session: Session): Promise<T> {
    throw new Error('Method not implemented.');
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

    return parsed;
  }

  public parse(remote: any, query: SearchIdentifier): T {
    const result = super.newModel();

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
