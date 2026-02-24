import type { CartCapabilityDefinition } from '@reactionary/core';
import { commercetoolsCartAdd } from './cart-add.js';
import { commercetoolsCartById } from './cart-by-id.js';
import type { CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsCartCapability = {
  cart: {
    byId: commercetoolsCartById,
    add: commercetoolsCartAdd,
  },
} satisfies CartCapabilityDefinition<CommercetoolsProcedureContext>;
