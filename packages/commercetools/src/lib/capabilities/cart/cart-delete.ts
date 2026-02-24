import { CartMutationDeleteCartSchema, success, type CartDeleteProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import * as z from 'zod';
import { deleteCommercetoolsCart } from './cart-client.js';

export const commercetoolsCartDelete = commercetoolsProcedure({
  inputSchema: CartMutationDeleteCartSchema,
  outputSchema: z.void(),
  fetch: async (query, _context, provider) => {
    if (query.cart.key) {
      await deleteCommercetoolsCart(provider, query.cart);
    }

    return success(undefined);
  },
  transform: async (_query, _context, _data) => {
    return success(undefined);
  },
}) satisfies CartDeleteProcedureDefinition<CommercetoolsProcedureContext>;
