import { CartMutationRemoveCouponSchema, CartSchema, success, type CartRemoveCouponProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartRemoveCouponCode = commercetoolsProcedure({
  inputSchema: CartMutationRemoveCouponSchema,
  outputSchema: CartSchema,
  fetch: async (query, _context, provider) => {
    const actions: MyCartUpdateAction[] = [
      {
        action: 'removeDiscountCode',
        discountCode: {
          id: query.couponCode,
          typeId: 'discount-code',
        },
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
}) satisfies CartRemoveCouponProcedureDefinition<CommercetoolsProcedureContext>;
