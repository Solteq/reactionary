import { CartIdentifierSchema, error, success, type CartActiveCartIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import * as z from 'zod';
import { getCommercetoolsCartClients } from './cart-client.js';

export const commercetoolsCartActiveCartId = commercetoolsProcedure({
  inputSchema: z.void(),
  outputSchema: CartIdentifierSchema,
  fetch: async (_query, _context, provider) => {
    const client = await getCommercetoolsCartClients(provider);
    try {
      const carts = await client.activeCart.get().execute();
      return success({
        key: carts.body.id,
      });
    } catch (_e) {
      return error({
        type: 'NotFound',
        identifier: {},
      });
    }
  },
  transform: async (_query, _context, data) => {
    return success(data);
  },
}) satisfies CartActiveCartIdProcedureDefinition<CommercetoolsProcedureContext>;
