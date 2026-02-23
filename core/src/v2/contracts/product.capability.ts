import type {
  ProductQueryByIdSchema,
  ProductSchema,
  RequestContext,
} from '../../schemas/index.js';
import type { CapabilityProcedureDefiniton } from '../core/capability-procedure.js';

export type ProductByIdProcedureDefinition = CapabilityProcedureDefiniton<
  RequestContext,
  typeof ProductQueryByIdSchema,
  typeof ProductSchema
>;
export type ProductBySlugProcedureDefinition = CapabilityProcedureDefiniton<
  RequestContext,
  typeof ProductQueryByIdSchema,
  typeof ProductSchema
>;

export type ProductCapabilityDefinition = {
  product: {
    byId: ProductByIdProcedureDefinition;
    bySlug: ProductBySlugProcedureDefinition;
  };
};
