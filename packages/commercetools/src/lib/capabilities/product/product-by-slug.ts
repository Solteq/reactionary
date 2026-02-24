import { ProductQueryBySlugSchema, ProductSchema, success, type ProductBySlugProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsProductBySlug = commercetoolsProcedure({
  inputSchema: ProductQueryBySlugSchema,
  outputSchema: ProductSchema,
  fetch: async (query, context, provider) => {
    return success({ foo: 'bar'});
  },
  transform: async (query, context, data, provider) => {
    return success({} as any);
  },
}) satisfies ProductBySlugProcedureDefinition<CommercetoolsProcedureContext>;