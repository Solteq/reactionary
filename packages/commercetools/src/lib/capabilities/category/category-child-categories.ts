import {
  CategoryQueryForChildCategoriesSchema,
  success,
  type CategoryChildCategoriesProcedureDefinition,
} from '@reactionary/core';
import * as z from 'zod';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import {
  createEmptyCategoryPaginatedResult,
  parseCommercetoolsCategoryPaginatedResult,
} from './category-mapper.js';
import type { CommercetoolsResolvedCategoryExtension } from './category-extension.js';

export function createCommercetoolsCategoryChildCategories<
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
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: extension.paginatedSchema,
    fetch: async (query, context, provider) => {
      const client = await getCommercetoolsCategoryClient(provider);

      try {
        const parentCategory = await client
          .withKey({ key: query.parentId.key })
          .get()
          .execute();

        const response = await client
          .get({
            queryArgs: {
              where: 'parent(id = :parentId)',
              'var.parentId': parentCategory.body.id,
              limit: query.paginationOptions.pageSize,
              offset:
                (query.paginationOptions.pageNumber - 1) *
                query.paginationOptions.pageSize,
              sort: 'orderHint asc',
              storeProjection: context.request.storeIdentifier.key,
            },
          })
          .execute();

        return success(response.body);
      } catch (_e) {
        return success(null);
      }
    },
    transform: async (query, context, data) => {
      if (!data) {
        return success(
          extension.paginatedSchema.parse(
            createEmptyCategoryPaginatedResult(
              query.paginationOptions.pageNumber,
              query.paginationOptions.pageSize,
            ),
          ),
        );
      }

      const baseResult = parseCommercetoolsCategoryPaginatedResult(
        data,
        context.request.languageContext.locale,
      );

      if (!extension.transform) {
        return success(extension.paginatedSchema.parse(baseResult));
      }

      const transformedItems = [];
      for (let i = 0; i < baseResult.items.length; i++) {
        const transformedCategory = await extension.transform({
          category: baseResult.items[i],
          rawCategory: data.results[i],
          context,
        });
        transformedItems.push(transformedCategory);
      }

      return success(
        extension.paginatedSchema.parse({
          ...baseResult,
          items: transformedItems,
        }),
      );
    },
  }) satisfies CategoryChildCategoriesProcedureDefinition<
    CommercetoolsProcedureContext,
    CategoryPaginatedOutputSchema
  >;
}
