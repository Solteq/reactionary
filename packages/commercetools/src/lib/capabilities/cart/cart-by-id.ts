import { CartQueryByIdSchema, CartSchema, error, success, type CartByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCartClients } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartById = commercetoolsProcedure({
  inputSchema: CartQueryByIdSchema,
  outputSchema: CartSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsCartClients(provider);
    const ctId = query.cart as { key: string };

    try {
      const remote = await client.carts.withId({ ID: ctId.key }).get().execute();
      return success(remote.body);
    } catch (_e) {
      return error({
        type: 'NotFound',
        identifier: query.cart,
      });
    }
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsCart(data));
  },
}) satisfies CartByIdProcedureDefinition<CommercetoolsProcedureContext>;
