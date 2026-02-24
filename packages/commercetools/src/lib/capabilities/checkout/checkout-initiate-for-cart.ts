import {
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutSchema,
  success,
  type CheckoutInitiateForCartProcedureDefinition,
} from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsCheckout } from './checkout-mapper.js';

export const commercetoolsCheckoutInitiateForCart = commercetoolsProcedure({
  inputSchema: CheckoutMutationInitiateCheckoutSchema,
  outputSchema: CheckoutSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);

    const cart = await client.carts
      .withId({ ID: query.cart.identifier.key })
      .get()
      .execute();

    const replicationResponse = await client.carts
      .replicate()
      .post({
        body: {
          reference: {
            typeId: 'cart',
            id: cart.body.id,
          },
        },
      })
      .execute();

    const actions: MyCartUpdateAction[] = [
      {
        action: 'setCustomType',
        type: {
          typeId: 'type',
          key: 'reactionaryCheckout',
        },
        fields: {
          commerceToolsCartId: query.cart.identifier.key,
        },
      },
    ];

    if (query.billingAddress) {
      actions.push({
        action: 'setBillingAddress',
        address: {
          country: query.billingAddress.countryCode,
          firstName: query.billingAddress.firstName || '',
          lastName: query.billingAddress.lastName || '',
          streetName: query.billingAddress.streetAddress || '',
          streetNumber: query.billingAddress.streetNumber || '',
          postalCode: query.billingAddress.postalCode || '',
          city: query.billingAddress.city || '',
          email: query.notificationEmail || '',
          phone: query.notificationPhone || '',
        },
      });
      actions.push({
        action: 'setShippingAddress',
        address: {
          country: query.billingAddress.countryCode,
          firstName: query.billingAddress.firstName || '',
          lastName: query.billingAddress.lastName || '',
          streetName: query.billingAddress.streetAddress || '',
          streetNumber: query.billingAddress.streetNumber || '',
          postalCode: query.billingAddress.postalCode || '',
          city: query.billingAddress.city || '',
        },
      });
    }

    const checkoutResponse = await client.carts
      .withId({ ID: replicationResponse.body.id })
      .post({
        body: {
          version: replicationResponse.body.version || 0,
          actions,
        },
      })
      .execute();

    return success(checkoutResponse.body);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsCheckout(data, context.request.languageContext.locale));
  },
}) satisfies CheckoutInitiateForCartProcedureDefinition<CommercetoolsProcedureContext>;
