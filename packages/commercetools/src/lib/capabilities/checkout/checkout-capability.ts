import type { CheckoutCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsCheckoutAddPaymentInstruction } from './checkout-add-payment-instruction.js';
import { commercetoolsCheckoutAvailablePaymentMethods } from './checkout-available-payment-methods.js';
import { commercetoolsCheckoutAvailableShippingMethods } from './checkout-available-shipping-methods.js';
import { commercetoolsCheckoutById } from './checkout-by-id.js';
import { commercetoolsCheckoutFinalize } from './checkout-finalize.js';
import { commercetoolsCheckoutInitiateForCart } from './checkout-initiate-for-cart.js';
import { commercetoolsCheckoutRemovePaymentInstruction } from './checkout-remove-payment-instruction.js';
import { commercetoolsCheckoutSetShippingAddress } from './checkout-set-shipping-address.js';
import { commercetoolsCheckoutSetShippingInstruction } from './checkout-set-shipping-instruction.js';

export const commercetoolsCheckoutCapability = {
  checkout: {
    initiateForCart: commercetoolsCheckoutInitiateForCart,
    byId: commercetoolsCheckoutById,
    setShippingAddress: commercetoolsCheckoutSetShippingAddress,
    availableShippingMethods: commercetoolsCheckoutAvailableShippingMethods,
    availablePaymentMethods: commercetoolsCheckoutAvailablePaymentMethods,
    addPaymentInstruction: commercetoolsCheckoutAddPaymentInstruction,
    removePaymentInstruction: commercetoolsCheckoutRemovePaymentInstruction,
    setShippingInstruction: commercetoolsCheckoutSetShippingInstruction,
    finalize: commercetoolsCheckoutFinalize,
  },
} satisfies CheckoutCapabilityDefinition<CommercetoolsProcedureContext>;
