import type * as z from 'zod';
import type {
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type ProductByIdProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  OutputSchema extends z.ZodTypeAny = typeof ProductSchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryByIdSchema,
  OutputSchema
>;
export type ProductBySlugProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  OutputSchema extends z.ZodTypeAny = typeof ProductSchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryBySlugSchema,
  OutputSchema
>;
export type ProductBySkuProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  OutputSchema extends z.ZodTypeAny = typeof ProductSchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProductQueryBySKUSchema,
  OutputSchema
>;

export type ProductCapabilityDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  OutputSchema extends z.ZodTypeAny = typeof ProductSchema
> = {
  product: {
    byId: ProductByIdProcedureDefinition<Context, OutputSchema>;
    bySlug: ProductBySlugProcedureDefinition<Context, OutputSchema>;
    bySku: ProductBySkuProcedureDefinition<Context, OutputSchema>;
  };
};
