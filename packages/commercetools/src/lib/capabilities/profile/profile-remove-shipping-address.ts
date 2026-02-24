import {
  ProfileMutationRemoveShippingAddressSchema,
  ProfileSchema,
  error,
  success,
  type ProfileRemoveShippingAddressProcedureDefinition,
} from '@reactionary/core';
import type { MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileRemoveShippingAddress = commercetoolsProcedure({
  inputSchema: ProfileMutationRemoveShippingAddressSchema,
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

    const addressToRemove = customer.addresses.find(
      (address) => address.key === query.addressIdentifier.nickName,
    );
    if (!addressToRemove) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    const actions: MyCustomerUpdateAction[] = [
      {
        action: 'removeAddress',
        addressId: addressToRemove.id!,
      },
    ];

    const needsNewDefaultShippingAddress = customer.defaultShippingAddressId === addressToRemove.id;
    if (needsNewDefaultShippingAddress) {
      const newDefaultAddress = customer.addresses.find(
        (address) => address.id !== addressToRemove.id && address.id !== customer.defaultBillingAddressId,
      );
      if (newDefaultAddress?.key) {
        actions.push({
          action: 'setDefaultShippingAddress',
          addressKey: newDefaultAddress.key,
        });
      }
    }

    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions,
        },
      })
      .execute();

    return success(updateResponse.body);
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsProfile(data));
  },
}) satisfies ProfileRemoveShippingAddressProcedureDefinition<CommercetoolsProcedureContext>;
