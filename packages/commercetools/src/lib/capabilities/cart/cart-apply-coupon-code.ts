import { CartMutationApplyCouponSchema, CartSchema, success, type CartApplyCouponProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartApplyCouponCode = commercetoolsProcedure({
  inputSchema: CartMutationApplyCouponSchema,
  outputSchema: CartSchema,
  fetch: async (query, _context, provider) => {
    const actions: MyCartUpdateAction[] = [
      {
        action: 'addDiscountCode',
        code: query.couponCode,
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
}) satisfies CartApplyCouponProcedureDefinition<CommercetoolsProcedureContext>;
