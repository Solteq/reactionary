import { IdentityMutationLoginSchema, IdentitySchema, success, type IdentityLoginProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsIdentityLogin = commercetoolsProcedure({
  inputSchema: IdentityMutationLoginSchema,
  outputSchema: IdentitySchema,
  fetch: async (query, _context, provider) => {
    const identity = await provider.client.login(query.username, query.password);
    return success(identity);
  },
  transform: async (_query, context, identity) => {
    context.request.session.identityContext.lastUpdated = new Date();
    context.request.session.identityContext.identity = identity;
    return success(identity);
  },
}) satisfies IdentityLoginProcedureDefinition<CommercetoolsProcedureContext>;
