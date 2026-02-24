import { IdentityQuerySelfSchema, IdentitySchema, success, type IdentitySelfProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsIdentitySelf = commercetoolsProcedure({
  inputSchema: IdentityQuerySelfSchema,
  outputSchema: IdentitySchema,
  fetch: async (_query, _context, provider) => {
    const identity = await provider.client.introspect();
    return success(identity);
  },
  transform: async (_query, context, identity) => {
    context.request.session.identityContext.lastUpdated = new Date();
    context.request.session.identityContext.identity = identity;
    return success(identity);
  },
}) satisfies IdentitySelfProcedureDefinition<CommercetoolsProcedureContext>;
