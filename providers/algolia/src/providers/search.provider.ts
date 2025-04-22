import {
  SearchIdentifier,
  SearchProvider,
  SearchResult,
  SearchResultSchema,
} from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaConfig } from '../core/configuration';

export class AlgoliaSearchProvider<T extends SearchResult> extends SearchProvider<T> {
  protected config: AlgoliaConfig;

  constructor(config: AlgoliaConfig) {
    super();

    this.config = config;
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    const result: SearchResult = SearchResultSchema.parse({});
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const remote = await client.search({
      requests: [
        {
          indexName: this.config.indexName,
          query: identifier.term,
          page: identifier.page,
          hitsPerPage: identifier.pageSize,
        },
      ],
    });

    const remoteProducts = remote.results[0] as any;

    for (const p of remoteProducts.hits) {
      result.products.push({
        identifier: {
            id: p.objectID
        },
        name: p.name,
        image: p.image,
      });
    }
    
    result.identifier = identifier;
    result.pages = remoteProducts.nbHits;

    return SearchResultSchema.parse(result) as T;
  }
}
