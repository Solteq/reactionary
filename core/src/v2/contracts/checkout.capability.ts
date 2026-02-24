import type * as z from 'zod';
import type {
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutMutationFinalizeCheckoutSchema,
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutMutationSetShippingAddressSchema,
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutQueryByIdSchema,
  CheckoutQueryForAvailablePaymentMethodsSchema,
  CheckoutQueryForAvailableShippingMethodsSchema,
  CheckoutSchema,
  PaymentMethodSchema,
  ShippingMethodSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

type ShippingMethodsSchema = z.ZodArray<typeof ShippingMethodSchema>;
type PaymentMethodsSchema = z.ZodArray<typeof PaymentMethodSchema>;

export type CheckoutInitiateForCartProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationInitiateCheckoutSchema,
  typeof CheckoutSchema
>;

export type CheckoutByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutQueryByIdSchema,
  typeof CheckoutSchema
>;

export type CheckoutSetShippingAddressProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationSetShippingAddressSchema,
  typeof CheckoutSchema
>;

export type CheckoutAvailableShippingMethodsProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutQueryForAvailableShippingMethodsSchema,
  ShippingMethodsSchema
>;

export type CheckoutAvailablePaymentMethodsProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutQueryForAvailablePaymentMethodsSchema,
  PaymentMethodsSchema
>;

export type CheckoutAddPaymentInstructionProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationAddPaymentInstructionSchema,
  typeof CheckoutSchema
>;

export type CheckoutRemovePaymentInstructionProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationRemovePaymentInstructionSchema,
  typeof CheckoutSchema
>;

export type CheckoutSetShippingInstructionProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationSetShippingInstructionSchema,
  typeof CheckoutSchema
>;

export type CheckoutFinalizeProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CheckoutMutationFinalizeCheckoutSchema,
  typeof CheckoutSchema
>;

export type CheckoutCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  checkout: {
    initiateForCart: CheckoutInitiateForCartProcedureDefinition<Context>;
    byId: CheckoutByIdProcedureDefinition<Context>;
    setShippingAddress: CheckoutSetShippingAddressProcedureDefinition<Context>;
    availableShippingMethods: CheckoutAvailableShippingMethodsProcedureDefinition<Context>;
    availablePaymentMethods: CheckoutAvailablePaymentMethodsProcedureDefinition<Context>;
    addPaymentInstruction: CheckoutAddPaymentInstructionProcedureDefinition<Context>;
    removePaymentInstruction: CheckoutRemovePaymentInstructionProcedureDefinition<Context>;
    setShippingInstruction: CheckoutSetShippingInstructionProcedureDefinition<Context>;
    finalize: CheckoutFinalizeProcedureDefinition<Context>;
  };
};
