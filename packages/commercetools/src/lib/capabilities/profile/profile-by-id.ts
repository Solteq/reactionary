import { ProfileQueryByIdSchema, ProfileSchema, error, success, type ProfileByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProfileClient } from './profile-client.js';
import { parseCommercetoolsProfile } from './profile-mapper.js';

export const commercetoolsProfileById = commercetoolsProcedure({
  inputSchema: ProfileQueryByIdSchema,
  outputSchema: ProfileSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsProfileClient(provider);
    const remote = await client.me().get().execute();

    if (remote.body.id !== query.identifier.userId) {
      return error({
        type: 'NotFound',
        identifier: query.identifier,
      });
    }

    return success(remote.body);
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsProfile(data));
  },
}) satisfies ProfileByIdProcedureDefinition<CommercetoolsProcedureContext>;
