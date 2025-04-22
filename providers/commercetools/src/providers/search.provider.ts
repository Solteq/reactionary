import {
  SearchIdentifier,
  SearchProvider,
  SearchResult,
  SearchResultProductSchema,
  SearchResultSchema,
} from '@reactionary/core';
import { CommercetoolsConfig } from '../core/configuration';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsSearchProvider<T extends SearchResult> extends SearchProvider<T> {
  protected config: CommercetoolsConfig;

  constructor(config: CommercetoolsConfig) {
    super();

    this.config = config;
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    const result = SearchResultSchema.parse({});
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

    result.identifier = identifier;

    for (const p of remote.body.results) {
      const product = SearchResultProductSchema.parse({});

      product.identifier.id = p.id;
      product.name = p.name['en-US'];

      if (p.masterVariant.images) {
        product.image = p.masterVariant.images[0].url;
    }

      result.products.push(product)
    }

    result.pages = Math.ceil((remote.body.total || 0) / identifier.pageSize);

    // FIXME: See if we can get rid of this with some additional contraints on Schema and through inferring type
    return SearchResultSchema.parse(result) as T;
  }
}
