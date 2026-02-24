import { CartMutationChangeCurrencySchema, CartSchema, success, type CartChangeCurrencyProcedureDefinition } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCartActions, createCommercetoolsCart, getCommercetoolsCartClients } from './cart-client.js';
import { parseCommercetoolsCart } from './cart-mapper.js';

export const commercetoolsCartChangeCurrency = commercetoolsProcedure({
  inputSchema: CartMutationChangeCurrencySchema,
  outputSchema: CartSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsCartClients(provider);
    const currentCart = await client.carts
      .withId({ ID: query.cart.key })
      .get()
      .execute();

    const newCart = await createCommercetoolsCart(
      provider,
      query.newCurrency,
      context.request.taxJurisdiction.countryCode,
      context.request.languageContext.locale,
    );

    const cartItemAdds: MyCartUpdateAction[] = currentCart.body.lineItems.map((item) => ({
      action: 'addLineItem',
      sku: item.variant.sku || '',
      quantity: item.quantity,
    }));

    const response = await applyCartActions(provider, newCart, [
      ...cartItemAdds,
      {
        action: 'recalculate',
      },
    ]);

    await client.carts
      .withId({ ID: query.cart.key })
      .delete({
        queryArgs: {
          version: currentCart.body.version || 0,
          dataErasure: false,
        },
      })
      .execute();

    return success(response);
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsCart(data));
  },
}) satisfies CartChangeCurrencyProcedureDefinition<CommercetoolsProcedureContext>;
