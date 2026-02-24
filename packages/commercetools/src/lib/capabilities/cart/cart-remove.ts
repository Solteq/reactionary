import { CartMutationItemRemoveSchema, CartSchema, success, type CartItemRemoveProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartRemove = commercetoolsProcedure({
  inputSchema: CartMutationItemRemoveSchema,
  outputSchema: CartSchema,
  fetch: async (query, _context, provider) => {
    const actions: MyCartUpdateAction[] = [
      {
        action: 'removeLineItem',
        lineItemId: query.item.key,
      },
      {
        action: 'recalculate',
      },
    ];

    return success(await applyCartActions(provider, query.cart, actions));
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsCart(data));
  },
}) satisfies CartItemRemoveProcedureDefinition<CommercetoolsProcedureContext>;
