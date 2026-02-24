import type { StoreCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsStoreByProximity } from './store-by-proximity.js';

export const commercetoolsStoreCapability = {
  store: {
    byProximity: commercetoolsStoreByProximity,
  },
} satisfies StoreCapabilityDefinition<CommercetoolsProcedureContext>;
