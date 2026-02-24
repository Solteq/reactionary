import { CategoryQueryForBreadcrumbSchema, CategorySchema, success, type CategoryBreadcrumbPathProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';

export const commercetoolsCategoryBreadcrumbPath = commercetoolsProcedure({
  inputSchema: CategoryQueryForBreadcrumbSchema,
  outputSchema: CategorySchema.array(),
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
      return success([]);
    }

    const path = [];
    for (const ancestor of data.ancestors ?? []) {
      if (ancestor.obj) {
        path.push(parseCommercetoolsCategory(ancestor.obj, context.request.languageContext.locale));
      }
    }

    path.push(parseCommercetoolsCategory(data, context.request.languageContext.locale));
    return success(path);
  },
}) satisfies CategoryBreadcrumbPathProcedureDefinition<CommercetoolsProcedureContext>;
