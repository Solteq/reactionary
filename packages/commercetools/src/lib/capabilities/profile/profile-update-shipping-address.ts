import {
  ProfileMutationUpdateShippingAddressSchema,
  ProfileSchema,
  error,
  success,
  type ProfileUpdateShippingAddressProcedureDefinition,
} from '@reactionary/core';
import type { MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { createCommercetoolsAddressDraft, parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileUpdateShippingAddress = commercetoolsProcedure({
  inputSchema: ProfileMutationUpdateShippingAddressSchema,
  outputSchema: ProfileSchema,
  fetch: async (query, context, provider) => {
    const client = await getCommercetoolsProfileClient(provider);
    const remote = await client.me().get().execute();
    const customer = remote.body;

    if (customer.id !== query.identifier.userId) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    const targetAddress = customer.addresses.find((address) => address.key === query.address.identifier.nickName);
    if (!targetAddress) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: [
            {
              action: 'changeAddress',
              addressId: targetAddress.id!,
              address: createCommercetoolsAddressDraft(query.address, context.request.taxJurisdiction.countryCode),
            },
          ] as MyCustomerUpdateAction[],
        },
      })
      .execute();

    return success(updateResponse.body);
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsProfile(data));
  },
}) satisfies ProfileUpdateShippingAddressProcedureDefinition<CommercetoolsProcedureContext>;
