import type { OrderCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsOrderById } from './order-by-id.js';

export const commercetoolsOrderCapability = {
  order: {
    byId: commercetoolsOrderById,
  },
} satisfies OrderCapabilityDefinition<CommercetoolsProcedureContext>;
