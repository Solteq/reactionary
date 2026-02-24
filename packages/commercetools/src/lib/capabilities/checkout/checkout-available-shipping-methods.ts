import {
  CheckoutQueryForAvailableShippingMethodsSchema,
  ShippingMethodSchema,
  success,
  type CheckoutAvailableShippingMethodsProcedureDefinition,
} from '@reactionary/core';
import type { ShippingMethod as CTShippingMethod } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCheckoutClients } from './checkout-client.js';
import { parseCommercetoolsShippingMethods } from './checkout-mapper.js';

export const commercetoolsCheckoutAvailableShippingMethods = commercetoolsProcedure({
  inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
  outputSchema: ShippingMethodSchema.array(),
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsCheckoutClients(provider);
    const response = await client.shippingMethods
      .matchingCart()
      .get({
        queryArgs: {
          cartId: query.checkout.key,
        },
      })
      .execute();

    return success(response.body.results as CTShippingMethod[]);
  },
  transform: async (_query, context, data) => {
    return success(
      parseCommercetoolsShippingMethods(
        data,
        context.request.languageContext.locale,
        context.request.languageContext.currencyCode,
      ),
    );
  },
}) satisfies CheckoutAvailableShippingMethodsProcedureDefinition<CommercetoolsProcedureContext>;
