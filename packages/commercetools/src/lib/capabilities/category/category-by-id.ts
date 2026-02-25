import {
  CategoryQueryByIdSchema,
  error,
  success,
  type CategoryByIdProcedureDefinition,
} from '@reactionary/core';
import * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';
import type { CommercetoolsResolvedCategoryExtension } from './category-extension.js';

export function createCommercetoolsCategoryById<
  CategoryOutputSchema extends z.ZodTypeAny,
  CategoryPathOutputSchema extends z.ZodTypeAny,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny,
>(
  extension: CommercetoolsResolvedCategoryExtension<
    CategoryOutputSchema,
    CategoryPathOutputSchema,
    CategoryPaginatedOutputSchema
  >
) {
  return commercetoolsProcedure({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: extension.schema,
    fetch: async (query, _context, provider) => {
      const client = await getCommercetoolsCategoryClient(provider);

      try {
        const response = await client
          .withKey({ key: query.id.key })
          .get()
          .execute();

        return success(response.body);
      } catch (_e) {
        return error({
          type: 'NotFound',
          identifier: query.id,
        });
      }
    },
    transform: async (_query, context, data) => {
      const mappedCategory = parseCommercetoolsCategory(
        data,
        context.request.languageContext.locale
      );

      const transformedCategory = extension.transform
        ? await extension.transform({
            category: mappedCategory,
            rawCategory: data,
            context,
          })
        : mappedCategory;

      return success(extension.schema.parse(transformedCategory));
    },
  }) satisfies CategoryByIdProcedureDefinition<
    CommercetoolsProcedureContext,
    CategoryOutputSchema
  >;
}
