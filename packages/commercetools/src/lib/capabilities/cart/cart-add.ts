import { CartMutationItemAddSchema, CartSchema, success, type CartItemAddProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsCartAdd = commercetoolsProcedure({
  inputSchema: CartMutationItemAddSchema,
  outputSchema: CartSchema,
  fetch: async (_query, _context, _provider) => {
    return success({ foo: 'bar' });
  },
  transform: async (_query, _context, _data, _provider) => {
    return success({} as any);
  },
}) satisfies CartItemAddProcedureDefinition<CommercetoolsProcedureContext>;
