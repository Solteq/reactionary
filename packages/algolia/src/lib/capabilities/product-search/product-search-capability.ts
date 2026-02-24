import type { ProductSearchCapabilityDefinition } from '@reactionary/core';
import type { AlgoliaProcedureContext } from '../../core/context.js';
import { algoliaProductSearchByTerm } from './product-search-by-term.js';
import { algoliaProductSearchCreateCategoryNavigationFilter } from './product-search-create-category-navigation-filter.js';

export const algoliaProductSearchCapability = {
  productSearch: {
    byTerm: algoliaProductSearchByTerm,
    createCategoryNavigationFilter: algoliaProductSearchCreateCategoryNavigationFilter,
  },
} satisfies ProductSearchCapabilityDefinition<AlgoliaProcedureContext>;
