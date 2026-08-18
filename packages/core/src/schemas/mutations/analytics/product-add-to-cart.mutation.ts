import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import {
  ProductIdentifierSchema,
  ProductSearchIdentifierSchema,
} from '../../models/identifiers.model.js';
import { AnalyticsBaseMutationSchema } from './base-event.mutation.js';

export const AnalyticsMutationProductAddToCartEventSchema =
  AnalyticsBaseMutationSchema.extend({
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
