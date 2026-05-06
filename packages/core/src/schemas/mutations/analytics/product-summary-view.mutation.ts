import type { InferType } from '../../../zod-utils.js';
import {
  ProductIdentifierSchema,
  ProductSearchIdentifierSchema,
} from '../../models/identifiers.model.js';
import { BaseMutationSchema } from '../base.mutation.js';
import * as z from 'zod';
import { AnalyticsBaseMutationSchema } from './base-event.mutation.js';

export const AnalyticsMutationProductSummaryViewEventSchema =
  AnalyticsBaseMutationSchema.extend({
    event: z.literal('product-summary-view'),
    source: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('search'),
          identifier: ProductSearchIdentifierSchema,
        }),
      ])
      .optional(),
    products: z.array(ProductIdentifierSchema),
  });

export type AnalyticsMutationProductSummaryViewEvent = InferType<
  typeof AnalyticsMutationProductSummaryViewEventSchema
>;
