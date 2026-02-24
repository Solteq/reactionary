import { CartQueryByIdSchema, CartSchema, success, type CartByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsCartById = commercetoolsProcedure({
  inputSchema: CartQueryByIdSchema,
  outputSchema: CartSchema,
  fetch: async (_query, _context, _provider) => {
    return success({ foo: 'bar' });
  },
  transform: async (_query, _context, _data, _provider) => {
    return success({} as any);
  },
}) satisfies CartByIdProcedureDefinition<CommercetoolsProcedureContext>;
