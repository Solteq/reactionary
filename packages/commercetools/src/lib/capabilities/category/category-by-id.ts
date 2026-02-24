import { CategoryQueryByIdSchema, CategorySchema, error, success, type CategoryByIdProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { getCommercetoolsCategoryClient } from './category-client.js';
import { parseCommercetoolsCategory } from './category-mapper.js';

export const commercetoolsCategoryById = commercetoolsProcedure({
  inputSchema: CategoryQueryByIdSchema,
  outputSchema: CategorySchema,
  fetch: async (query, context, provider) => {
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
    return success(parseCommercetoolsCategory(data, context.request.languageContext.locale));
  },
}) satisfies CategoryByIdProcedureDefinition<CommercetoolsProcedureContext>;
