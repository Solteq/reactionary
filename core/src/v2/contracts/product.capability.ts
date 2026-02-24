import type {
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type ProductByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryByIdSchema,
  typeof ProductSchema
>;
export type ProductBySlugProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryBySlugSchema,
  typeof ProductSchema
>;
export type ProductBySkuProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryBySKUSchema,
  typeof ProductSchema
>;

export type ProductCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  product: {
    byId: ProductByIdProcedureDefinition<Context>;
    bySlug: ProductBySlugProcedureDefinition<Context>;
    bySku: ProductBySkuProcedureDefinition<Context>;
  };
};
