import {
  SearchProvider,
  SearchQueryByTerm,
  SearchResult,
  SearchResultProduct,
  Session,
  Cache,
} from '@reactionary/core';
import { CommercetoolsClient } from '../core/client';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';

export class CommercetoolsSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async queryByTerm(
    payload: SearchQueryByTerm,
    _session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
      .search()
      .get({
        queryArgs: {
          limit: payload.search.pageSize,
          offset: payload.search.pageSize * payload.search.page,
          ['text.en-US']: payload.search.term,
        },
      })
      .execute();

    return this.parseSearchResult(remote, payload);
  }

  protected parseSearchResult(remote: unknown, payload: SearchQueryByTerm): T {
    const result = this.newModel();
    const remoteData = remote as { body: { results: Array<{ id: string; name: Record<string, string>; slug?: Record<string, string>; masterVariant: { images?: Array<{ url?: string }> } }>; total?: number } };

    result.identifier = payload.search;

    for (const p of remoteData.body.results) {
      const product: SearchResultProduct = {
        identifier: { key: p.id },
        name: p.name['en-US'],
        slug: p.slug?.['en-US'] || p.id,
        image: p.masterVariant.images?.[0]?.url || 'https://placehold.co/400'
      };

      result.products.push(product);
    }

    result.pages = Math.ceil((remoteData.body.total || 0) / payload.search.pageSize);
    result.meta = {
      cache: { hit: false, key: payload.search.term },
      placeholder: false
    };

    return this.assert(result);
  }
}
