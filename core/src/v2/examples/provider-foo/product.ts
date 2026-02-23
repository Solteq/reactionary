import { ProductQueryByIdSchema, ProductSchema } from "../../../schemas/index.js";
import type { RequestContext } from "../../../schemas/session.schema.js";
import { procedure } from "../../core/provider.js";
import { success } from '../../../schemas/result.js'
import type { ProductByIdProcedureDefinition, ProductBySlugProcedureDefinition, ProductCapabilityDefinition } from "../../contracts/product.capability.js";

export const p = procedure<RequestContext>();

export const productById = p({
  inputSchema: ProductQueryByIdSchema,
  outputSchema: ProductSchema,
  fetch: async (query, context) => {
    return success({});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
}) satisfies ProductByIdProcedureDefinition;

export const productBySlug = p({
  inputSchema: ProductQueryByIdSchema,
  outputSchema: ProductSchema,
  fetch: async (query, context) => {
    return success({});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
}) satisfies ProductBySlugProcedureDefinition;

export const productCapability = {
  product: { byId: productById, bySlug: productBySlug },
} satisfies ProductCapabilityDefinition;