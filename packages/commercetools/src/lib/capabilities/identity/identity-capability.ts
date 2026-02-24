import type { IdentityCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsIdentityLogin } from './identity-login.js';
import { commercetoolsIdentityLogout } from './identity-logout.js';
import { commercetoolsIdentityRegister } from './identity-register.js';
import { commercetoolsIdentitySelf } from './identity-self.js';

export const commercetoolsIdentityCapability = {
  identity: {
    self: commercetoolsIdentitySelf,
    login: commercetoolsIdentityLogin,
    logout: commercetoolsIdentityLogout,
    register: commercetoolsIdentityRegister,
  },
} satisfies IdentityCapabilityDefinition<CommercetoolsProcedureContext>;
