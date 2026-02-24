import type {
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type OrderSearchByTermProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof OrderSearchQueryByTermSchema,
  typeof OrderSearchResultSchema
>;

export type OrderSearchCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  orderSearch: {
    byTerm: OrderSearchByTermProcedureDefinition<Context>;
  };
};
