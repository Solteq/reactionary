import type * as z from 'zod';
import type {
  StoreQueryByProximitySchema,
  StoreSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

type StoresSchema = z.ZodArray<typeof StoreSchema>;

export type StoreByProximityProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof StoreQueryByProximitySchema,
  StoresSchema
>;

export type StoreCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  store: {
    byProximity: StoreByProximityProcedureDefinition<Context>;
  };
};
