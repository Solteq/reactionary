import type { ProductSearchCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsProductSearchByTerm } from './product-search-by-term.js';
import { commercetoolsProductSearchCreateCategoryNavigationFilter } from './product-search-create-category-navigation-filter.js';

export const commercetoolsProductSearchCapability = {
  productSearch: {
    byTerm: commercetoolsProductSearchByTerm,
    createCategoryNavigationFilter: commercetoolsProductSearchCreateCategoryNavigationFilter,
  },
} satisfies ProductSearchCapabilityDefinition<CommercetoolsProcedureContext>;
