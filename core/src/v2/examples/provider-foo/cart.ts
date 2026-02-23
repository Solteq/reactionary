import {
  CartMutationItemAddSchema,
  CartMutationItemRemoveSchema,
  CartSchema,
} from '../../../schemas/index.js';
import type { RequestContext } from '../../../schemas/session.schema.js';
import { procedure } from '../../core/provider.js';
import { success } from '../../../schemas/result.js';
import { type ClientDefinition } from '../../core/client.js';

export const p = procedure<RequestContext>();

export const cartAdd = p({
  inputSchema: CartMutationItemAddSchema,
  outputSchema: CartSchema,
  fetch: async (query, context) => {
    return success({});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
});

export const cartRemove = p({
  inputSchema: CartMutationItemRemoveSchema,
  outputSchema: CartSchema,
  fetch: async (query, context) => {
    return success({});
  },
  transform: async (query, context, data) => {
    return success({} as any);
  },
});

export const cartCapability = {
  cart: { add: cartAdd, remove: cartRemove },
} satisfies ClientDefinition<RequestContext>;
