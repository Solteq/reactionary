import type {
  ProfileMutationAddShippingAddressSchema,
  ProfileMutationMakeShippingAddressDefaultSchema,
  ProfileMutationRemoveShippingAddressSchema,
  ProfileMutationSetBillingAddressSchema,
  ProfileMutationUpdateSchema,
  ProfileMutationUpdateShippingAddressSchema,
  ProfileQueryByIdSchema,
  ProfileSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type ProfileByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileQueryByIdSchema,
  typeof ProfileSchema
>;

export type ProfileUpdateProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationUpdateSchema,
  typeof ProfileSchema
>;

export type ProfileAddShippingAddressProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationAddShippingAddressSchema,
  typeof ProfileSchema
>;

export type ProfileUpdateShippingAddressProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationUpdateShippingAddressSchema,
  typeof ProfileSchema
>;

export type ProfileRemoveShippingAddressProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationRemoveShippingAddressSchema,
  typeof ProfileSchema
>;

export type ProfileMakeShippingAddressDefaultProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationMakeShippingAddressDefaultSchema,
  typeof ProfileSchema
>;

export type ProfileSetBillingAddressProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ProfileMutationSetBillingAddressSchema,
  typeof ProfileSchema
>;

export type ProfileCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  profile: {
    byId: ProfileByIdProcedureDefinition<Context>;
    update: ProfileUpdateProcedureDefinition<Context>;
    addShippingAddress: ProfileAddShippingAddressProcedureDefinition<Context>;
    updateShippingAddress: ProfileUpdateShippingAddressProcedureDefinition<Context>;
    removeShippingAddress: ProfileRemoveShippingAddressProcedureDefinition<Context>;
    makeShippingAddressDefault: ProfileMakeShippingAddressDefaultProcedureDefinition<Context>;
    setBillingAddress: ProfileSetBillingAddressProcedureDefinition<Context>;
  };
};
