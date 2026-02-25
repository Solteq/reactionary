import {
  ProductQueryBySlugSchema,
  error,
  success,
  type ProductBySlugProcedureDefinition,
} from '@reactionary/core';
import type * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsProductClient } from './product-client.js';
import { parseCommercetoolsProduct } from './product-mapper.js';
import type { CommercetoolsProductExtension } from './product-extension.js';

export function createCommercetoolsProductBySlug<
  ProductOutputSchema extends z.ZodTypeAny,
>(
  extension: CommercetoolsProductExtension<ProductOutputSchema>
) {
  return commercetoolsProcedure({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: extension.schema,
    fetch: async (query, _context, provider) => {
      const client = await getCommercetoolsProductClient(provider);

      const remote = await client
        .get({
          queryArgs: {
            where: 'slug(en = :slug)',
            'var.slug': query.slug,
          },
        })
        .execute();

      return success(remote.body);
    },
    transform: async (query, context, data) => {
      if (data.count === 0) {
        return error({
          type: 'NotFound',
          identifier: query.slug,
        });
      }

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
  }) satisfies ProductBySlugProcedureDefinition<
    CommercetoolsProcedureContext,
    ProductOutputSchema
  >;
}
