import type { ProductCapabilityDefinition } from '@reactionary/core';
import { commercetoolsProductById } from './product-by-id.js';
import { commercetoolsProductBySlug } from './product-by-slug.js';
import type { CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsProductCapability = {
  product: {
    byId: commercetoolsProductById,
    bySlug: commercetoolsProductBySlug,
  },
} satisfies ProductCapabilityDefinition<CommercetoolsProcedureContext>;
