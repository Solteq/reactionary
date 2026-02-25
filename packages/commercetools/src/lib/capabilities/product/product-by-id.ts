import {
  ProductQueryByIdSchema,
  success,
  type ProductByIdProcedureDefinition,
} from '@reactionary/core';
import type * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProductClient } from './product-client.js';
import { parseCommercetoolsProduct } from './product-mapper.js';
import type { CommercetoolsProductExtension } from './product-extension.js';

export function createCommercetoolsProductById<
  ProductOutputSchema extends z.ZodTypeAny,
>(
  extension: CommercetoolsProductExtension<ProductOutputSchema>
) {
  return commercetoolsProcedure({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: extension.schema,
    fetch: async (query, _context, provider) => {
      const client = await getCommercetoolsProductClient(provider);
      const remote = await client
        .withKey({ key: query.identifier.key })
        .get()
        .execute();

      return success(remote.body);
    },
    transform: async (_query, context, data) => {
      const mappedProduct = parseCommercetoolsProduct(
        data,
        context.request.languageContext.locale
      );

      const transformed = extension.transform
        ? await extension.transform({
            product: mappedProduct,
            rawProduct: data,
            context,
          })
        : mappedProduct;

      return success(extension.schema.parse(transformed));
    },
  }) satisfies ProductByIdProcedureDefinition<
    CommercetoolsProcedureContext,
    ProductOutputSchema
  >;
}
