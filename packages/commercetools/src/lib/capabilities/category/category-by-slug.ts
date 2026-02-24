import { CategoryQueryBySlugSchema, CategorySchema, error, success, type CategoryBySlugProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';

export const commercetoolsCategoryBySlug = commercetoolsProcedure({
  inputSchema: CategoryQueryBySlugSchema,
  outputSchema: CategorySchema,
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

    return success(parseCommercetoolsCategory(data.results[0], context.request.languageContext.locale));
  },
}) satisfies CategoryBySlugProcedureDefinition<CommercetoolsProcedureContext>;
