import {
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutSchema,
  success,
  type CheckoutAddPaymentInstructionProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCheckoutActions, getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutAddPaymentInstruction = commercetoolsProcedure({
  inputSchema: CheckoutMutationAddPaymentInstructionSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);

    const payment = await client.payments
      .post({
        body: {
          amountPlanned: {
            centAmount: Math.round(query.paymentInstruction.amount.value * 100),
            currencyCode: query.paymentInstruction.amount.currency,
          },
          paymentMethodInfo: {
            method: query.paymentInstruction.paymentMethod.method,
            name: {
              [context.request.languageContext.locale]: query.paymentInstruction.paymentMethod.name,
            },
            paymentInterface: query.paymentInstruction.paymentMethod.paymentProcessor,
          },
          custom: {
            type: {
              typeId: 'type',
              key: 'reactionaryPaymentCustomFields',
            },
            fields: {
              commerceToolsCartId: query.checkout.key,
            },
          },
        },
      })
      .execute();

    const updatedCheckout = await applyCheckoutActions(provider, query.checkout, [
      {
        action: 'addPayment',
        payment: {
          typeId: 'payment',
          id: payment.body.id,
        },
      },
    ]);

    return success(updatedCheckout);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutAddPaymentInstructionProcedureDefinition<CommercetoolsProcedureContext>;
