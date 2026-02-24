import { ProfileMutationUpdateSchema, ProfileSchema, error, success, type ProfileUpdateProcedureDefinition } from '@reactionary/core';
import type { MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileUpdate = commercetoolsProcedure({
  inputSchema: ProfileMutationUpdateSchema,
  outputSchema: ProfileSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsProfileClient(provider);
    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== query.identifier.userId) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    const actions: MyCustomerUpdateAction[] = [];
    if (query.email !== undefined) {
      actions.push({
        action: 'changeEmail',
        email: query.email,
      });
    }

    const mainAddress = customer.defaultBillingAddressId
      ? customer.addresses.find((address) => address.id === customer.defaultBillingAddressId)
      : null;

    if (!mainAddress) {
      actions.push({
        action: 'addAddress',
        address: {
          key: `billing-address-${customer.id}`,
          email: query.email || customer.email,
          phone: query.phone,
          country: context.request.taxJurisdiction.countryCode,
        },
      });

      actions.push({
        action: 'setDefaultBillingAddress',
        addressKey: `billing-address-${customer.id}`,
      });
    } else {
      actions.push({
        action: 'changeAddress',
        addressId: mainAddress.id!,
        address: {
          ...mainAddress,
          email: query.email || customer.email,
          phone: query.phone,
        },
      });
    }

    if (actions.length > 0) {
      const updateResponse = await client
        .me()
        .post({
          body: {
            version: customer.version,
            actions,
          },
        })
        .execute();
      customer = updateResponse.body;
    }

    return success(customer);
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsProfile(data));
  },
}) satisfies ProfileUpdateProcedureDefinition<CommercetoolsProcedureContext>;
