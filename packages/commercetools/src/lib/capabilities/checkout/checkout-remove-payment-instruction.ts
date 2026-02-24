import {
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutSchema,
  error,
  success,
  type CheckoutRemovePaymentInstructionProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutRemovePaymentInstruction = commercetoolsProcedure({
  inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);

    try {
      const checkoutResponse = await client.carts
        .withId({ ID: query.checkout.key })
        .get({
          queryArgs: {
            expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
          },
        })
        .execute();

      return success(checkoutResponse.body);
    } catch (_e) {
      return error({
        type: 'NotFound',
        identifier: query.checkout,
      });
    }
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutRemovePaymentInstructionProcedureDefinition<CommercetoolsProcedureContext>;
