import { OrderQueryByIdSchema, OrderSchema, error, success, type OrderByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { parseCommercetoolsOrder } from './order-mapper.js';

export const commercetoolsOrderById = commercetoolsProcedure({
  inputSchema: OrderQueryByIdSchema,
  outputSchema: OrderSchema,
  fetch: async (query, _context, provider) => {
    const root = await provider.client.getClient();
    const client = root
      .withProjectKey({ projectKey: provider.config.projectKey })
      .me()
      .orders();

    try {
      const remote = await client
        .withId({ ID: query.order.key })
        .get()
        .execute();

      return success(remote.body);
    } catch (_e) {
      return error({
        type: 'NotFound',
        identifier: query,
      });
    }
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsOrder(data));
  },
}) satisfies OrderByIdProcedureDefinition<CommercetoolsProcedureContext>;
