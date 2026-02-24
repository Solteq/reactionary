import {
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutSchema,
  success,
  type CheckoutSetShippingInstructionProcedureDefinition,
} from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCheckoutActions } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutSetShippingInstruction = commercetoolsProcedure({
  inputSchema: CheckoutMutationSetShippingInstructionSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, _context, provider) => {
    const actions: MyCartUpdateAction[] = [
      {
        action: 'setShippingMethod',
        shippingMethod: {
          typeId: 'shipping-method',
          key: query.shippingInstruction.shippingMethod.key,
        },
      },
      {
        action: 'setCustomField',
        name: 'shippingInstruction',
        value: query.shippingInstruction.instructions,
      },
      {
        action: 'setCustomField',
        name: 'consentForUnattendedDelivery',
        value: `${query.shippingInstruction.consentForUnattendedDelivery}`,
      },
      {
        action: 'setCustomField',
        name: 'pickupPointId',
        value: query.shippingInstruction.pickupPoint,
      },
    ];

    const checkout = await applyCheckoutActions(provider, query.checkout, actions);
    return success(checkout);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutSetShippingInstructionProcedureDefinition<CommercetoolsProcedureContext>;
