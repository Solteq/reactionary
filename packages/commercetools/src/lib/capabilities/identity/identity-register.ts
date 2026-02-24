import { IdentityMutationRegisterSchema, IdentitySchema, success, type IdentityRegisterProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsIdentityRegister = commercetoolsProcedure({
  inputSchema: IdentityMutationRegisterSchema,
  outputSchema: IdentitySchema,
  fetch: async (query, _context, provider) => {
    const identity = await provider.client.register(query.username, query.password);
    return success(identity);
  },
  transform: async (_query, context, identity) => {
    context.request.session.identityContext.lastUpdated = new Date();
    context.request.session.identityContext.identity = identity;
    return success(identity);
  },
}) satisfies IdentityRegisterProcedureDefinition<CommercetoolsProcedureContext>;
