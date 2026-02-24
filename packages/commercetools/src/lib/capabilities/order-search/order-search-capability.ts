import type { OrderSearchCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsOrderSearchByTerm } from './order-search-by-term.js';

export const commercetoolsOrderSearchCapability = {
  orderSearch: {
    byTerm: commercetoolsOrderSearchByTerm,
  },
} satisfies OrderSearchCapabilityDefinition<CommercetoolsProcedureContext>;
