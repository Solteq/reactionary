import {
  SearchIdentifier,
  SearchProvider,
  SearchResult,
  SearchResultFacetSchema,
  SearchResultFacetValueSchema,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaConfig } from '../core/configuration';
import { z } from 'zod';

export class AlgoliaSearchProvider<
  T extends SearchResult
> extends SearchProvider<T> {
  protected config: AlgoliaConfig;

  constructor(config: AlgoliaConfig, schema: z.ZodType<T>) {
    super(schema);

    this.config = config;
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);
    const remote = await client.search<unknown>({
      requests: [
        {
          indexName: this.config.indexName,
          query: identifier.term,
          page: identifier.page,
          hitsPerPage: identifier.pageSize,
          facets: ['*'],
          facetFilters: identifier.facets.map(
            (x) => `${encodeURIComponent(x.facet.key)}:${x.key}`
          ),
        },
      ],
    });

    const parsed = this.parse(remote, identifier);
    const validated = this.validate(parsed);

    return validated;
  }

  public override parse(remote: any, query: SearchIdentifier): T {
    const result = this.base();

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

    result.identifier = query;
    result.pages = remoteProducts.nbPages;

    return result;
  }
}
