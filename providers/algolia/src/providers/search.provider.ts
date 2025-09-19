import {
  type SearchQueryByTerm,
  type SearchResult,
  type SearchResultFacet,
  type SearchResultProduct,
  type RequestContext,
  type Cache,
  SearchProvider,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import type { z } from 'zod';
import type { AlgoliaConfiguration } from '../schema/configuration.schema';

export class AlgoliaSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async queryByTerm(
    payload: SearchQueryByTerm,
    _reqCtx: RequestContext
  ): Promise<SearchResult> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);
    const remote = await client.search<unknown>({
      requests: [
        {
          indexName: this.config.indexName,
          query: payload.search.term,
          page: payload.search.page,
          hitsPerPage: payload.search.pageSize,
          facets: ['*'],
          analytics: true,
          clickAnalytics: true,
          facetFilters: payload.search.facets.map(
            (x) => `${encodeURIComponent(x.facet.key)}:${x.key}`
          ),
        },
      ],
    });

    return this.parseSearchResult(remote, payload);
  }

  protected parseSearchResult(remote: unknown, payload: SearchQueryByTerm): T {
    const result = this.newModel();
    const remoteData = remote as { results: Array<{ facets: Record<string, Record<string, number>>; hits: Array<{ objectID: string; slug?: string; name?: string; image?: string }>; index: string; queryID: string; nbPages: number }> };
    const remoteProducts = remoteData.results[0];

    // Parse facets
    for (const id in remoteProducts.facets) {
      const f = remoteProducts.facets[id];

      const facet = {
        identifier: { key: id },
        name: id,
        values: []
      } as SearchResultFacet;

      for (const vid in f) {
        const fv = f[vid];
        const isActive = payload.search.facets.find(
          (x) => x.facet.key === id && x.key === vid
        );

        facet.values.push({
          identifier: { key: vid, facet: { key: id } },
          count: fv,
          name: vid,
          active: !!isActive
        });
      }

      result.facets.push(facet);
    }

    // Parse products
    for (const p of remoteProducts.hits) {
      result.products.push({
        identifier: { key: p.objectID },
        slug: p.slug,
        name: p.name,
        image: p.image
      } as SearchResultProduct);
    }

    // Set result metadata
    result.identifier = {
      ...payload.search,
      index: remoteProducts.index,
      key: remoteProducts.queryID
    };
    result.pages = remoteProducts.nbPages;
    result.meta = {
      cache: { hit: false, key: payload.search.term },
      placeholder: false
    };

    return this.assert(result);
  }
}
