import type {
  IdentityMutationLoginSchema,
  IdentityMutationLogoutSchema,
  IdentityMutationRegisterSchema,
  IdentityQuerySelfSchema,
  IdentitySchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type IdentitySelfProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof IdentityQuerySelfSchema,
  typeof IdentitySchema
>;

export type IdentityLoginProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof IdentityMutationLoginSchema,
  typeof IdentitySchema
>;

export type IdentityLogoutProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof IdentityMutationLogoutSchema,
  typeof IdentitySchema
>;

export type IdentityRegisterProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof IdentityMutationRegisterSchema,
  typeof IdentitySchema
>;

export type IdentityCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  identity: {
    self: IdentitySelfProcedureDefinition<Context>;
    login: IdentityLoginProcedureDefinition<Context>;
    logout: IdentityLogoutProcedureDefinition<Context>;
    register: IdentityRegisterProcedureDefinition<Context>;
  };
};
