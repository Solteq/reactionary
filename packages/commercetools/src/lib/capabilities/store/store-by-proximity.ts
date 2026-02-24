import { StoreQueryByProximitySchema, StoreSchema, success, type StoreByProximityProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { parseCommercetoolsStore } from './store-mapper.js';

export const commercetoolsStoreByProximity = commercetoolsProcedure({
  inputSchema: StoreQueryByProximitySchema,
  outputSchema: StoreSchema.array(),
  fetch: async (query, _context, provider) => {
    const root = await provider.client.getClient();
    const client = root.withProjectKey({ projectKey: provider.config.projectKey });

    const remote = await client
      .channels()
      .get({
        queryArgs: {
          limit: query.limit,
          where: `geoLocation within circle(${query.longitude}, ${
            query.latitude
          }, ${
            query.distance * 1000
          }) AND roles contains any ("InventorySupply")`,
        },
      })
      .execute();

    return success(remote.body.results);
  },
  transform: async (_query, _context, data) => {
    return success(data.map((entry) => parseCommercetoolsStore(entry)));
  },
}) satisfies StoreByProximityProcedureDefinition<CommercetoolsProcedureContext>;
