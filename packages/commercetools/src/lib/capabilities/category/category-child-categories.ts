import { CategoryPaginatedResultSchema, CategoryQueryForChildCategoriesSchema, success, type CategoryChildCategoriesProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import {
  createEmptyCategoryPaginatedResult,
  parseCommercetoolsCategoryPaginatedResult,
} from './category-mapper.js';

export const commercetoolsCategoryChildCategories = commercetoolsProcedure({
  inputSchema: CategoryQueryForChildCategoriesSchema,
  outputSchema: CategoryPaginatedResultSchema,
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
        createEmptyCategoryPaginatedResult(
          query.paginationOptions.pageNumber,
          query.paginationOptions.pageSize,
        ),
      );
    }

    return success(
      parseCommercetoolsCategoryPaginatedResult(
        data,
        context.request.languageContext.locale,
      ),
    );
  },
}) satisfies CategoryChildCategoriesProcedureDefinition<CommercetoolsProcedureContext>;
