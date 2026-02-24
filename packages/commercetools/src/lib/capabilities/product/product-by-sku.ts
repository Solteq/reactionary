import { ProductQueryBySKUSchema, ProductSchema, success, type ProductBySkuProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProductClient } from './product-client.js';
import { parseCommercetoolsProduct } from './product-mapper.js';

export const commercetoolsProductBySku = commercetoolsProcedure({
  inputSchema: ProductQueryBySKUSchema,
  outputSchema: ProductSchema,
  fetch: async (query, _context, provider) => {
    const client = await getCommercetoolsProductClient(provider);

    const remote = await client
      .get({
        queryArgs: {
          staged: false,
          limit: 1,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [query.variant.sku],
        },
      })
      .execute();

    return success(remote.body);
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsProduct(data.results[0], context.request.languageContext.locale));
  },
}) satisfies ProductBySkuProcedureDefinition<CommercetoolsProcedureContext>;
