import {
  CategoryQueryForBreadcrumbSchema,
  success,
  type CategoryBreadcrumbPathProcedureDefinition,
} from '@reactionary/core';
import type { Category as CommercetoolsCategory } from '@commercetools/platform-sdk';
import * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';
import type { CommercetoolsResolvedCategoryExtension } from './category-extension.js';

export function createCommercetoolsCategoryBreadcrumbPath<
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
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: extension.breadcrumbPathSchema,
    fetch: async (query, _context, provider) => {
      const client = await getCommercetoolsCategoryClient(provider);

      try {
        const response = await client
          .withKey({ key: query.id.key })
          .get({
            queryArgs: {
              expand: 'ancestors[*]',
            },
          })
          .execute();

        return success(response.body);
      } catch (_e) {
        return success(null);
      }
    },
    transform: async (_query, context, data) => {
      if (!data) {
        return success(extension.breadcrumbPathSchema.parse([]));
      }

      const rawPath: CommercetoolsCategory[] = [];
      for (const ancestor of data.ancestors ?? []) {
        if (ancestor.obj) {
          rawPath.push(ancestor.obj);
        }
      }
      rawPath.push(data);

      const transformedPath = [];
      for (const rawCategory of rawPath) {
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
        transformedPath.push(transformedCategory);
      }

      return success(extension.breadcrumbPathSchema.parse(transformedPath));
    },
  }) satisfies CategoryBreadcrumbPathProcedureDefinition<
    CommercetoolsProcedureContext,
    CategoryOutputSchema,
    CategoryPathOutputSchema
  >;
}
