import {
  SearchIdentifier,
  SearchProvider,
  SearchResult,
  SearchResultFacetSchema,
  SearchResultFacetValueSchema,
  SearchResultSchema,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaConfig } from '../core/configuration';

export class AlgoliaSearchProvider<
  T extends SearchResult
> extends SearchProvider<T> {
  protected config: AlgoliaConfig;

  constructor(config: AlgoliaConfig) {
    super();

    this.config = config;
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    const result: SearchResult = SearchResultSchema.parse({});
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const remote = await client.search<unknown>({
      requests: [
        {
          indexName: this.config.indexName,
          query: identifier.term,
          page: identifier.page,
          hitsPerPage: identifier.pageSize,
          facets: ['*'],
          facetFilters: identifier.facets.map((x) => `${encodeURIComponent(x.facet.key)}:${x.key}`),
        },
      ],
    });

    const remoteProducts = remote.results[0] as any;

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
          identifier.facets.find(
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

    result.identifier = identifier;
    result.pages = remoteProducts.nbPages;

    return SearchResultSchema.parse(result) as T;
  }
}
