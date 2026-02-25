import {
  ProductSchema,
  type ProductCapabilityDefinition,
} from '@reactionary/core';
import { createCommercetoolsProductById } from './product-by-id.js';
import { createCommercetoolsProductBySku } from './product-by-sku.js';
import { createCommercetoolsProductBySlug } from './product-by-slug.js';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import type * as z from 'zod';
import type { CommercetoolsProductExtension } from './product-extension.js';

export function createCommercetoolsProductCapability<
  ProductOutputSchema extends z.ZodTypeAny = typeof ProductSchema,
>(
  extension: CommercetoolsProductExtension<ProductOutputSchema>
) {
  return {
    product: {
      byId: createCommercetoolsProductById(extension),
      bySlug: createCommercetoolsProductBySlug(extension),
      bySku: createCommercetoolsProductBySku(extension),
    },
  } satisfies ProductCapabilityDefinition<
    CommercetoolsProcedureContext,
    ProductOutputSchema
  >;
}

export const commercetoolsProductCapability =
  createCommercetoolsProductCapability({
    schema: ProductSchema,
  });
