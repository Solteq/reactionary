import { ProductQueryByIdSchema, ProductSchema, success, type ProductByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsProductById = commercetoolsProcedure({
  inputSchema: ProductQueryByIdSchema,
  outputSchema: ProductSchema,
  fetch: async (query, context) => {
    return success({ foo: 'bar'});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
}) satisfies ProductByIdProcedureDefinition<CommercetoolsProcedureContext>;
