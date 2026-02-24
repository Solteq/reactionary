import { CartMutationItemAddSchema, CartSchema, success, type CartItemAddProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions, createCommercetoolsCart } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartAdd = commercetoolsProcedure({
  inputSchema: CartMutationItemAddSchema,
  outputSchema: CartSchema,
  fetch: async (query, context, provider) => {
    let cartIdentifier = query.cart;
    if (!cartIdentifier) {
      cartIdentifier = await createCommercetoolsCart(
        provider,
        context.request.languageContext.currencyCode,
        context.request.taxJurisdiction.countryCode,
        context.request.languageContext.locale,
      );
    }

    const actions: MyCartUpdateAction[] = [
      {
        action: 'addLineItem',
        quantity: query.quantity,
        sku: query.variant.sku,
        distributionChannel: {
          typeId: 'channel',
          key: 'OnlineFfmChannel',
        },
      },
      {
        action: 'recalculate',
      },
    ];

    return success(await applyCartActions(provider, cartIdentifier, actions));
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsCart(data));
  },
}) satisfies CartItemAddProcedureDefinition<CommercetoolsProcedureContext>;
