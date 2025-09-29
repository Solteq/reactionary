import { SearchProvider } from '@reactionary/core';
import type {
  SearchResult,
  SearchResultProduct,
  Cache,
  SearchQueryByTerm,
  Session, RequestContext,
} from '@reactionary/core';

import { CommercetoolsClient } from '../core/client';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { traced } from '@reactionary/otel';

export class CommercetoolsSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  @traced()
  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }


  public override async queryByTerm(
    payload: SearchQueryByTerm,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);

    const remote = await client
      .search()
      .get({
        queryArgs: {
          limit: payload.search.pageSize,
          offset: (payload.search.page - 1) * payload.search.pageSize,
          [`text.${reqCtx.languageContext.locale}`]: payload.search.term,
        },
      })
      .execute();

    return this.parseSearchResult(remote, payload, reqCtx);
  }

  protected parseSearchResult(
    remote: unknown,
    payload: SearchQueryByTerm,
    reqCtx: RequestContext
  ): T {
    const result = this.newModel();
    const remoteData = remote as {
      body: {
        results: Array<{
          id: string;
          name: Record<string, string>;
          slug?: Record<string, string>;
          masterVariant: { images?: Array<{ url?: string }> };
        }>;
        total?: number;
      };
    };

    result.identifier = payload.search;

    for (const p of remoteData.body.results) {
      const product: SearchResultProduct = {
        identifier: { key: p.id },
        name: p.name[reqCtx.languageContext.locale] || p.id,
        slug: p.slug?.[reqCtx.languageContext.locale] || p.id,
        image: p.masterVariant.images?.[0]?.url || 'https://placehold.co/400',
      };

      result.products.push(product);
    }

    result.pages = Math.ceil(
      (remoteData.body.total || 0) / payload.search.pageSize
    );
    result.meta = {
      cache: { hit: false, key: payload.search.term },
      placeholder: false,
    };

    return this.assert(result);
  }
}
