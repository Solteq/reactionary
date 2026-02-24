import { ProductQueryByIdSchema, ProductSchema, success, type ProductByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProductClient } from './product-client.js';
import { parseCommercetoolsProduct } from './product-mapper.js';

export const commercetoolsProductById = commercetoolsProcedure({
  inputSchema: ProductQueryByIdSchema,
  outputSchema: ProductSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsProductClient(provider);
    const remote = await client
      .withKey({ key: query.identifier.key })
      .get()
      .execute();

    return success(remote.body);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsProduct(data, context.request.languageContext.locale));
  },
}) satisfies ProductByIdProcedureDefinition<CommercetoolsProcedureContext>;
