import {
  CheckoutQueryForAvailablePaymentMethodsSchema,
  PaymentMethodSchema,
  success,
  type CheckoutAvailablePaymentMethodsProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsCheckoutAvailablePaymentMethods = commercetoolsProcedure({
  inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
  outputSchema: PaymentMethodSchema.array(),
  fetch: async (_query, _context, provider) => {
    return success(provider.config.paymentMethods || []);
  },
  transform: async (_query, _context, data) => {
    return success(data);
  },
}) satisfies CheckoutAvailablePaymentMethodsProcedureDefinition<CommercetoolsProcedureContext>;
