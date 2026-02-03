import z from 'zod';
import {
  ProductSearchIdentifierSchema,
  ProductIdentifierSchema,
} from '../../models/identifiers.model.js';
import { BaseMutationSchema } from '../base.mutation.js';
import type { InferType } from '../../../zod-utils.js';

export const AnalyticsMutationProductAddToCartEventSchema =
  BaseMutationSchema.extend({
    event: z.literal('product-cart-add'),
    source: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('search'),
          identifier: ProductSearchIdentifierSchema,
        }),
      ])
      .optional(),
    product: ProductIdentifierSchema,
  });

export type AnalyticsMutationProductAddToCartEvent = InferType<
  typeof AnalyticsMutationProductAddToCartEventSchema
>;
