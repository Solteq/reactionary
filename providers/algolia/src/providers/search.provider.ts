import {
  SearchIdentifier,
  SearchMutation,
  SearchProvider,
  SearchQuery,
  SearchResult,
  SearchResultFacetSchema,
  SearchResultFacetValueSchema,
  Session,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { z } from 'zod';
import { AlgoliaConfiguration } from '../schema/configuration.schema';

export class AlgoliaSearchProvider<
  T extends SearchResult = SearchResult,
  Q extends SearchQuery = SearchQuery,
  M extends SearchMutation = SearchMutation
> extends SearchProvider<T, Q, M> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>, querySchema: z.ZodType<Q, Q>, mutationSchema: z.ZodType<M, M>) {
    super(schema, querySchema, mutationSchema);

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

  protected async get(identifier: SearchIdentifier): Promise<T> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);
    const remote = await client.search<unknown>({
      requests: [
        {
          indexName: this.config.indexName,
          query: identifier.term,
          page: identifier.page,
          hitsPerPage: identifier.pageSize,
          facets: ['*'],
          analytics: true,
          clickAnalytics: true,
          facetFilters: identifier.facets.map(
            (x) => `${encodeURIComponent(x.facet.key)}:${x.key}`
          ),
        },
      ],
    });

    const parsed = this.parse(remote, identifier);

    return parsed;
  }

  protected parse(remote: any, query: SearchIdentifier): T {
    const result = this.newModel();

    const remoteProducts = remote.results[0];

    for (const id in remoteProducts.facets) {
      const f = remoteProducts.facets[id];

      const facet = SearchResultFacetSchema.parse({});
      facet.identifier.key = id;
      facet.name = id;

      for (const vid in f) {
        const fv = f[vid];

        const facetValue = SearchResultFacetValueSchema.parse({});
        facetValue.count = fv;
        facetValue.name = vid;
        facetValue.identifier.key = vid;
        facetValue.identifier.facet = facet.identifier;

        if (
          query.facets.find(
            (x) =>
              x.facet.key == facetValue.identifier.facet.key &&
              x.key == facetValue.identifier.key
          )
        ) {
          facetValue.active = true;
        }

        facet.values.push(facetValue);
      }

      result.facets.push(facet);
    }

    for (const p of remoteProducts.hits) {
      result.products.push({
        identifier: {
          key: p.objectID,
        },
        slug: p.slug,
        name: p.name,
        image: p.image,
      });
    }

    result.identifier = {
      ...query,
      index: remoteProducts.index,
      key: remoteProducts.queryID
    };
    result.pages = remoteProducts.nbPages;

    return result;
  }
}
