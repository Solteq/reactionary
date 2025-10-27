import {
  SearchProvider,
  type Cache,
  type RequestContext,
  type SearchQueryByTerm,
  type SearchResult,
  type SearchResultProduct,
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaClient } from '../core/client.js';
import type { StoreProductListResponse } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:search');

export class MedusaSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
    this.config = config;
  }

  public override async queryByTerm(
    payload: SearchQueryByTerm,
    reqCtx: RequestContext
  ): Promise<SearchResult> {

    const client = await new MedusaClient(this.config).getClient(reqCtx);

    const response = await client.store.product.list({
      q: payload.search.term,
      limit: payload.search.pageSize,
      offset: (payload.search.page - 1) * payload.search.pageSize,
    });

    return this.parseSearchResult(response, payload);
  }

  protected parseSearchResult(remote: StoreProductListResponse, payload: SearchQueryByTerm): T {
    const result = this.newModel();

    // Parse facets
    // no facets available from Medusa at the moment


    // Parse products
    for (const p of remote.products) {
      const heroVariant = p.variants?.[0];
      result.products.push({
        identifier: { key: heroVariant?.id },
        slug: p.handle,
        name: heroVariant?.title || p.title,
        image: p.images?.[0].url ?? undefined,
      } as SearchResultProduct);
    }

    // Set result metadata
    result.identifier = {
      ...payload.search,
    };
    result.pages = Math.ceil(remote.count / payload.search.pageSize);
    result.meta = {
      cache: { hit: false, key: payload.search.term },
      placeholder: false
    };

    return this.assert(result);
  }


}
