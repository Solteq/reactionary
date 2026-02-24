import type {
  FacetValueIdentifierSchema,
  ProductSearchQueryByTermSchema,
  ProductSearchQueryCreateNavigationFilterSchema,
  ProductSearchResultSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type ProductSearchByTermProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductSearchQueryByTermSchema,
  typeof ProductSearchResultSchema
>;

export type ProductSearchCreateCategoryNavigationFilterProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductSearchQueryCreateNavigationFilterSchema,
  typeof FacetValueIdentifierSchema
>;

export type ProductSearchCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  productSearch: {
    byTerm: ProductSearchByTermProcedureDefinition<Context>;
    createCategoryNavigationFilter: ProductSearchCreateCategoryNavigationFilterProcedureDefinition<Context>;
  };
};
