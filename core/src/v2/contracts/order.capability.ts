import type {
  OrderQueryByIdSchema,
  OrderSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type OrderByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof OrderQueryByIdSchema,
  typeof OrderSchema
>;

export type OrderCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  order: {
    byId: OrderByIdProcedureDefinition<Context>;
  };
};
