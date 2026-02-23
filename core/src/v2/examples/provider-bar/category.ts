import { CategoryQueryByIdSchema, CategorySchema } from "../../../schemas/index.js";
import type { RequestContext } from "../../../schemas/session.schema.js";
import { procedure } from "../../core/provider.js";
import { success } from '../../../schemas/result.js'
import { type ClientDefinition } from "../../core/client.js";

export const p = procedure<RequestContext>();

export const categoryById = p({
  inputSchema: CategoryQueryByIdSchema,
  outputSchema: CategorySchema,
  fetch: async (query, context) => {
    return success({ foo: 'bar'});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
});

export const categoryCapability = {
  category: { byId: categoryById },
} satisfies ClientDefinition<RequestContext>;