import type {
  InventoryQueryBySKUSchema,
  InventorySchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type InventoryBySkuProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof InventoryQueryBySKUSchema,
  typeof InventorySchema
>;

export type InventoryCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  inventory: {
    bySku: InventoryBySkuProcedureDefinition<Context>;
  };
};
