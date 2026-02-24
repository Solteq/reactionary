import type { ProfileCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsProfileAddShippingAddress } from './profile-add-shipping-address.js';
import { commercetoolsProfileById } from './profile-by-id.js';
import { commercetoolsProfileMakeShippingAddressDefault } from './profile-make-shipping-address-default.js';
import { commercetoolsProfileRemoveShippingAddress } from './profile-remove-shipping-address.js';
import { commercetoolsProfileSetBillingAddress } from './profile-set-billing-address.js';
import { commercetoolsProfileUpdateShippingAddress } from './profile-update-shipping-address.js';
import { commercetoolsProfileUpdate } from './profile-update.js';

export const commercetoolsProfileCapability = {
  profile: {
    byId: commercetoolsProfileById,
    update: commercetoolsProfileUpdate,
    addShippingAddress: commercetoolsProfileAddShippingAddress,
    updateShippingAddress: commercetoolsProfileUpdateShippingAddress,
    removeShippingAddress: commercetoolsProfileRemoveShippingAddress,
    makeShippingAddressDefault: commercetoolsProfileMakeShippingAddressDefault,
    setBillingAddress: commercetoolsProfileSetBillingAddress,
  },
} satisfies ProfileCapabilityDefinition<CommercetoolsProcedureContext>;
