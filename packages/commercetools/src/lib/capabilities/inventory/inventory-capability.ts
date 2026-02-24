import type { InventoryCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsInventoryBySku } from './inventory-by-sku.js';

export const commercetoolsInventoryCapability = {
  inventory: {
    bySku: commercetoolsInventoryBySku,
  },
} satisfies InventoryCapabilityDefinition<CommercetoolsProcedureContext>;
