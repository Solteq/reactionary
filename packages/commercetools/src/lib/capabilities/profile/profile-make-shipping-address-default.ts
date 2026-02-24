import {
  ProfileMutationMakeShippingAddressDefaultSchema,
  ProfileSchema,
  error,
  success,
  type ProfileMakeShippingAddressDefaultProcedureDefinition,
} from '@reactionary/core';
import type { MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileMakeShippingAddressDefault = commercetoolsProcedure({
  inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
  outputSchema: ProfileSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsProfileClient(provider);
    const remote = await client.me().get().execute();
    const customer = remote.body;

    if (customer.id !== query.identifier.userId) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    const addressToMakeDefault = customer.addresses.find(
      (address) => address.key === query.addressIdentifier.nickName,
    );
    if (!addressToMakeDefault) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    if (addressToMakeDefault.id === customer.defaultBillingAddressId) {
      return error({
        type: 'InvalidInput',
        error: 'Cannot set shipping address as default billing address',
      });
    }

    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: [
            {
              action: 'setDefaultShippingAddress',
              addressKey: addressToMakeDefault.key,
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
}) satisfies ProfileMakeShippingAddressDefaultProcedureDefinition<CommercetoolsProcedureContext>;
