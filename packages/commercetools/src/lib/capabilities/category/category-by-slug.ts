import {
  CategoryQueryBySlugSchema,
  error,
  success,
  type CategoryBySlugProcedureDefinition,
} from '@reactionary/core';
import * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';
import type { CommercetoolsResolvedCategoryExtension } from './category-extension.js';

export function createCommercetoolsCategoryBySlug<
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
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: extension.schema,
    fetch: async (query, context, provider) => {
      const client = await getCommercetoolsCategoryClient(provider);

      try {
        const response = await client
          .get({
            queryArgs: {
              where: `slug(${context.request.languageContext.locale}=:slug)`,
              'var.slug': query.slug,
              storeProjection: context.request.storeIdentifier.key,
              limit: 1,
              withTotal: false,
            },
          })
          .execute();

        return success(response.body);
      } catch (_e) {
        return error({
          type: 'NotFound',
          identifier: query.slug,
        });
      }
    },
    transform: async (query, context, data) => {
      if (data.results.length === 0) {
        return error({
          type: 'NotFound',
          identifier: query.slug,
        });
      }

      const rawCategory = data.results[0];
      const mappedCategory = parseCommercetoolsCategory(
        rawCategory,
        context.request.languageContext.locale
      );

      const transformedCategory = extension.transform
        ? await extension.transform({
            category: mappedCategory,
            rawCategory,
            context,
          })
        : mappedCategory;

      return success(extension.schema.parse(transformedCategory));
    },
  }) satisfies CategoryBySlugProcedureDefinition<
    CommercetoolsProcedureContext,
    CategoryOutputSchema
  >;
}
