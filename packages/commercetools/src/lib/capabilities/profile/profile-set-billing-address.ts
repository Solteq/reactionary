import {
  ProfileMutationSetBillingAddressSchema,
  ProfileSchema,
  error,
  success,
  type ProfileSetBillingAddressProcedureDefinition,
} from '@reactionary/core';
import type { MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { createCommercetoolsAddressDraft, parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileSetBillingAddress = commercetoolsProcedure({
  inputSchema: ProfileMutationSetBillingAddressSchema,
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
    const mainAddress = customer.defaultBillingAddressId
      ? customer.addresses.find((address) => address.id === customer.defaultBillingAddressId)
      : null;

    if (!mainAddress) {
      const newAddress = createCommercetoolsAddressDraft(query.address, context.request.taxJurisdiction.countryCode);
      actions.push({
        action: 'addAddress',
        address: newAddress,
      });
      actions.push({
        action: 'setDefaultBillingAddress',
        addressKey: newAddress.key,
      });
    } else {
      actions.push({
        action: 'changeAddress',
        addressId: mainAddress.id!,
        address: createCommercetoolsAddressDraft(query.address, context.request.taxJurisdiction.countryCode),
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
}) satisfies ProfileSetBillingAddressProcedureDefinition<CommercetoolsProcedureContext>;
