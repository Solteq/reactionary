import {
  CheckoutMutationSetShippingAddressSchema,
  CheckoutSchema,
  success,
  type CheckoutSetShippingAddressProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { applyCheckoutActions } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutSetShippingAddress = commercetoolsProcedure({
  inputSchema: CheckoutMutationSetShippingAddressSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, _context, provider) => {
    const checkout = await applyCheckoutActions(provider, query.checkout, [
      {
        action: 'setShippingAddress',
        address: {
          country: query.shippingAddress.countryCode,
          firstName: query.shippingAddress.firstName || '',
          lastName: query.shippingAddress.lastName || '',
          streetName: query.shippingAddress.streetAddress || '',
          streetNumber: query.shippingAddress.streetNumber || '',
          postalCode: query.shippingAddress.postalCode || '',
          city: query.shippingAddress.city || '',
        },
      },
    ]);

    return success(checkout);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutSetShippingAddressProcedureDefinition<CommercetoolsProcedureContext>;
