import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchQueryCreateNavigationFilterSchema,
  success,
  type ProductSearchCreateCategoryNavigationFilterProcedureDefinition,
} from '@reactionary/core';
import { algoliaProcedure, type AlgoliaProcedureContext } from '../../core/context.js';

export const algoliaProductSearchCreateCategoryNavigationFilter = algoliaProcedure({
  inputSchema: ProductSearchQueryCreateNavigationFilterSchema,
  outputSchema: FacetValueIdentifierSchema,
  fetch: async (query) => {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });

    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: query.categoryPath.map((c) => c.name).join(' > '),
    });

    return success(facetValueIdentifier);
  },
  transform: async (_query, _context, data) => {
    return success(data);
  },
}) satisfies ProductSearchCreateCategoryNavigationFilterProcedureDefinition<AlgoliaProcedureContext>;
