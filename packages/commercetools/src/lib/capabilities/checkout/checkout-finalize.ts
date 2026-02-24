import {
  CheckoutMutationFinalizeCheckoutSchema,
  CheckoutSchema,
  error,
  success,
  type CheckoutFinalizeProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutFinalize = commercetoolsProcedure({
  inputSchema: CheckoutMutationFinalizeCheckoutSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);
    const checkoutResponse = await client.carts
      .withId({ ID: query.checkout.key })
      .get({
        queryArgs: {
          expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
        },
      })
      .execute();

    const checkout = parseCommercetoolsCheckout(checkoutResponse.body, context.request.languageContext.locale);
    if (!checkout.readyForFinalization) {
      return error({
        type: 'InvalidInput',
        error: `Checkout ${checkout.identifier.key} is not ready for finalization`,
      });
    }

    await client.orders
      .post({
        body: {
          id: checkoutResponse.body.id,
          version: checkoutResponse.body.version || 0,
        },
      })
      .execute();

    const finalized = await client.carts
      .withId({ ID: checkoutResponse.body.id })
      .get({
        queryArgs: {
          expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
        },
      })
      .execute();

    return success(finalized.body);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutFinalizeProcedureDefinition<CommercetoolsProcedureContext>;
