import {
  CheckoutQueryByIdSchema,
  CheckoutSchema,
  error,
  success,
  type CheckoutByIdProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutById = commercetoolsProcedure({
  inputSchema: CheckoutQueryByIdSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);

    try {
      const checkoutResponse = await client.carts
        .withId({ ID: query.identifier.key })
        .get({
          queryArgs: {
            expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
          },
        })
        .execute();

      let resultingOrderId: string | undefined;
      if (checkoutResponse.body.cartState === 'Ordered') {
        const order = await client.orders
          .get({
            queryArgs: {
              where: `cart(id="${checkoutResponse.body.id}")`,
            },
          })
          .execute();
        resultingOrderId = order.body.results[0]?.id;
      }

      return success({
        cart: checkoutResponse.body,
        resultingOrderId,
      });
    } catch (_e) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }
  },
  transform: async (_query, context, data) => {
    const checkout = parseCommercetoolsCheckout(data.cart, context.request.languageContext.locale);
    if (data.resultingOrderId) {
      checkout.resultingOrder = {
        key: data.resultingOrderId,
      };
    }
    return success(checkout);
  },
}) satisfies CheckoutByIdProcedureDefinition<CommercetoolsProcedureContext>;
