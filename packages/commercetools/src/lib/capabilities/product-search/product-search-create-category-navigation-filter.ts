import {
  ProductSearchQueryCreateNavigationFilterSchema,
  FacetValueIdentifierSchema,
  success,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchCreateCategoryNavigationFilterProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { resolveCommercetoolsCategoryFromKey } from './product-search-client.js';

export const commercetoolsProductSearchCreateCategoryNavigationFilter = commercetoolsProcedure({
  inputSchema: ProductSearchQueryCreateNavigationFilterSchema,
  outputSchema: FacetValueIdentifierSchema,
  fetch: async (query, _context, provider) => {
    const deepestCategory = query.categoryPath[query.categoryPath.length - 1];
    const resolvedCategory = await resolveCommercetoolsCategoryFromKey(provider, deepestCategory.identifier.key);
    const facetIdentifier: FacetIdentifier = { key: 'categories' };
    const facetValueIdentifier: FacetValueIdentifier = {
      facet: facetIdentifier,
      key: resolvedCategory.id || 'unknown',
    };

    return success(facetValueIdentifier);
  },
  transform: async (_query, _context, data) => {
    return success(data);
  },
}) satisfies ProductSearchCreateCategoryNavigationFilterProcedureDefinition<CommercetoolsProcedureContext>;
