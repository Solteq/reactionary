import {
  ProductQueryBySKUSchema,
  success,
  type ProductBySkuProcedureDefinition,
} from '@reactionary/core';
import type * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProductClient } from './product-client.js';
import { parseCommercetoolsProduct } from './product-mapper.js';
import type { CommercetoolsProductExtension } from './product-extension.js';

export function createCommercetoolsProductBySku<
  ProductOutputSchema extends z.ZodTypeAny,
>(
  extension: CommercetoolsProductExtension<ProductOutputSchema>
) {
  return commercetoolsProcedure({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: extension.schema,
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
      const rawProduct = data.results[0];
      const mappedProduct = parseCommercetoolsProduct(
        rawProduct,
        context.request.languageContext.locale
      );

      const transformed = extension.transform
        ? await extension.transform({
            product: mappedProduct,
            rawProduct,
            context,
          })
        : mappedProduct;

      return success(extension.schema.parse(transformed));
    },
  }) satisfies ProductBySkuProcedureDefinition<
    CommercetoolsProcedureContext,
    ProductOutputSchema
  >;
}
