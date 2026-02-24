import { IdentityMutationLogoutSchema, IdentitySchema, success, type IdentityLogoutProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsIdentityLogout = commercetoolsProcedure({
  inputSchema: IdentityMutationLogoutSchema,
  outputSchema: IdentitySchema,
  fetch: async (_query, _context, provider) => {
    const identity = await provider.client.logout();
    return success(identity);
  },
  transform: async (_query, context, identity) => {
    context.request.session.identityContext.lastUpdated = new Date();
    context.request.session.identityContext.identity = identity;
    return success(identity);
  },
}) satisfies IdentityLogoutProcedureDefinition<CommercetoolsProcedureContext>;
