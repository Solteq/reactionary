import {
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  success,
  type FacetValueIdentifier,
  type ProductSearchQueryByTerm,
  type ProductSearchByTermProcedureDefinition,
} from '@reactionary/core';
import type { ProductSearchFacetExpression } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import {
  getCommercetoolsProductSearchClient,
  resolveCommercetoolsCategoryFromId,
} from './product-search-client.js';
import { parseCommercetoolsProductSearchResult } from './product-search-mapper.js';

async function getFacetQuery(selectedFacetValue: FacetValueIdentifier) {
  if (selectedFacetValue.facet.key === 'categories') {
    return {
      exact: {
        field: 'categoriesSubTree',
        values: [selectedFacetValue.key],
        fieldType: 'text',
      },
    };
  }

  return {
    exact: {
      field: selectedFacetValue.facet.key,
      fieldType: 'text',
      value: selectedFacetValue.key,
    },
  };
}

async function getCategoryFilterExpression(query: ProductSearchQueryByTerm) {
  if (!query.search.categoryFilter?.key) {
    return undefined;
  }

  return {
    exact: {
      field: 'categoriesSubTree',
      values: [query.search.categoryFilter.key],
      fieldType: 'text',
    },
  };
}

async function getSearchTermExpression(
  query: ProductSearchQueryByTerm,
  locale: string,
) {
  if (query.search.term.trim().length === 0 || query.search.term === '*') {
    return undefined;
  }

  return {
    or: [
      {
        fullText: {
          field: 'name',
          language: locale,
          value: query.search.term,
        },
      },
      {
        fullText: {
          field: 'description',
          language: locale,
          value: query.search.term,
        },
      },
      {
        fullText: {
          field: 'searchKeywords',
          language: locale,
          value: query.search.term,
        },
      },
    ],
  };
}

async function getFacetsQuery(query: ProductSearchQueryByTerm) {
  if (query.search.facets.length === 0) {
    return undefined;
  }

  const facetsToApply = await Promise.all(query.search.facets.map((facet) => getFacetQuery(facet)));
  if (facetsToApply.length === 0) {
    return undefined;
  }
  if (facetsToApply.length === 1) {
    return facetsToApply[0];
  }

  return { and: facetsToApply };
}

function getFacetsToReturn(configFacets: string[]): ProductSearchFacetExpression[] {
  return configFacets.map((facet) => ({
    distinct: {
      name: facet,
      field: facet,
      fieldType: 'text',
      limit: 50,
    },
  }));
}

export const commercetoolsProductSearchByTerm = commercetoolsProcedure({
  inputSchema: ProductSearchQueryByTermSchema,
  outputSchema: ProductSearchResultSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsProductSearchClient(provider);

    const facetsToReturn = getFacetsToReturn(['categories', ...provider.config.facetFieldsForSearch]);
    const facetsToApply = await getFacetsQuery(query);
    const searchTermExpression = await getSearchTermExpression(query, context.request.languageContext.locale);
    const categoryFilterExpression = await getCategoryFilterExpression(query);

    let finalFilterExpression: any = searchTermExpression;
    if (facetsToApply) {
      finalFilterExpression = finalFilterExpression
        ? { and: [finalFilterExpression, facetsToApply] }
        : facetsToApply;
    }
    if (categoryFilterExpression) {
      finalFilterExpression = finalFilterExpression
        ? { and: [finalFilterExpression, categoryFilterExpression] }
        : categoryFilterExpression;
    }

    const response = await client
      .search()
      .post({
        body: {
          query: finalFilterExpression,
          productProjectionParameters: {
            storeProjection: context.request.storeIdentifier.key,
          },
          limit: query.search.paginationOptions.pageSize,
          offset:
            (query.search.paginationOptions.pageNumber - 1) *
            query.search.paginationOptions.pageSize,
          facets: facetsToReturn,
        },
      })
      .execute();

    return success({
      body: response.body,
      query,
    });
  },
  transform: async (query, context, data, provider) => {
    const result = parseCommercetoolsProductSearchResult(
      data.body,
      data.query,
      context.request.languageContext.locale,
    );

    const categoryFacet = result.facets.find((facet) => facet.identifier.key === 'categories');
    if (categoryFacet) {
      const resolvedCategories = await Promise.all(
        categoryFacet.values.map((value) => resolveCommercetoolsCategoryFromId(provider, value.identifier.key)),
      );
      for (const facetValue of categoryFacet.values) {
        const category = resolvedCategories.find((entry) => entry.id === facetValue.identifier.key);
        if (category) {
          facetValue.name = category.name[context.request.languageContext.locale] || category.id;
        }
      }
    }

    for (const selectedFacet of query.search.facets) {
      const facet = result.facets.find((entry) => entry.identifier.key === selectedFacet.facet.key);
      if (!facet) {
        continue;
      }
      const value = facet.values.find((entry) => entry.identifier.key === selectedFacet.key);
      if (value) {
        value.active = true;
      }
    }

    return success(result);
  },
}) satisfies ProductSearchByTermProcedureDefinition<CommercetoolsProcedureContext>;
