import type { InferType } from '../../../zod-utils.js';
import {
  ProductIdentifierSchema,
  ProductSearchIdentifierSchema,
} from '../../models/identifiers.model.js';
import { BaseMutationSchema } from '../base.mutation.js';
import * as z from 'zod';

export const AnalyticsMutationProductSummaryClickEventSchema =
  BaseMutationSchema.extend({
    event: z.literal('product-summary-click'),
    product: ProductIdentifierSchema,
    source: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('search'),
          identifier: ProductSearchIdentifierSchema,
        }),
      ])
      .optional(),
    position: z.number().min(0),
  });

export type AnalyticsMutationProductSummaryClickEvent = InferType<
  typeof AnalyticsMutationProductSummaryClickEventSchema
>;
