import {
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  success,
  type ProductSearchByTermProcedureDefinition,
} from '@reactionary/core';
import { algoliasearch, type SearchResponse } from 'algoliasearch';
import { algoliaProcedure, type AlgoliaProcedureContext } from '../../core/context.js';
import type { AlgoliaNativeRecord, AlgoliaProductSearchResult } from './product-search-types.js';
import { parseAlgoliaPaginatedResult } from './product-search-mapper.js';

export const algoliaProductSearchByTerm = algoliaProcedure({
  inputSchema: ProductSearchQueryByTermSchema,
  outputSchema: ProductSearchResultSchema,
  fetch: async (query, _context, provider) => {
    const client = algoliasearch(provider.config.appId, provider.config.apiKey);

    const facetsThatAreNotCategory = query.search.facets.filter((x) => x.facet.key !== 'categories');
    const categoryFacet =
      query.search.facets.find((x) => x.facet.key === 'categories') || query.search.categoryFilter;

    const finalFilters = [...(query.search.filters || [])];
    const finalFacetFilters = [...facetsThatAreNotCategory.map((x) => `${x.facet.key}:${x.key}`)];

    if (categoryFacet) {
      finalFilters.push(`categories:"${categoryFacet.key}"`);
    }

    const remote = await client.search<AlgoliaNativeRecord>({
      requests: [
        {
          indexName: provider.config.indexName,
          query: query.search.term,
          page: query.search.paginationOptions.pageNumber - 1,
          hitsPerPage: query.search.paginationOptions.pageSize,
          facets: ['*'],
          analytics: true,
          clickAnalytics: true,
          facetFilters: finalFacetFilters,
          filters: finalFilters.join(' AND '),
        },
      ],
    });

    return success(remote.results[0] as SearchResponse<AlgoliaNativeRecord>);
  },
  transform: async (query, _context, data) => {
    const result = parseAlgoliaPaginatedResult(data, query) as AlgoliaProductSearchResult;

    for (const selectedFacet of query.search.facets) {
      const facet = result.facets.find((f) => f.identifier.key === selectedFacet.facet.key);
      if (facet) {
        const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
        if (value) {
          value.active = true;
        }
      }
    }

    return success(result);
  },
}) satisfies ProductSearchByTermProcedureDefinition<AlgoliaProcedureContext>;
