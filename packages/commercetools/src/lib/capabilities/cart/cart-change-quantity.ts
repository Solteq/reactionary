import { CartMutationItemQuantityChangeSchema, CartSchema, success, type CartItemChangeQuantityProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions, getCommercetoolsCartClients } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartChangeQuantity = commercetoolsProcedure({
  inputSchema: CartMutationItemQuantityChangeSchema,
  outputSchema: CartSchema,
  fetch: async (query, _context, provider) => {
    if (query.quantity === 0) {
      const client = await getCommercetoolsCartClients(provider);
      const ctId = query.cart as { key: string };
      const existing = await client.carts.withId({ ID: ctId.key }).get().execute();
      return success(existing.body);
    }

    const actions: MyCartUpdateAction[] = [
      {
        action: 'changeLineItemQuantity',
        lineItemId: query.item.key,
        quantity: query.quantity,
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
}) satisfies CartItemChangeQuantityProcedureDefinition<CommercetoolsProcedureContext>;
