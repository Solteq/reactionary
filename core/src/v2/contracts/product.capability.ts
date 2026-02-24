import type {
  ProductQueryByIdSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
} from '../../schemas/index.js';
import type { ProcedureContext, ProviderCapabilityProcedureDefiniton, ProviderProcedureContext } from '../core/capability-procedure.js';

export type ProductByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefiniton<
  Context,
  ProcedureContext,
  typeof ProductQueryByIdSchema,
  typeof ProductSchema
>;
export type ProductBySlugProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefiniton<
  Context,
  ProcedureContext,
  typeof ProductQueryBySlugSchema,
  typeof ProductSchema
>;

export type ProductCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  product: {
    byId: ProductByIdProcedureDefinition<Context>;
    bySlug: ProductBySlugProcedureDefinition<Context>;
  };
};
