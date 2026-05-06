import * as z from 'zod';
import { ProductIdentifierSchema } from '../../models/identifiers.model.js';
import { BaseMutationSchema } from '../base.mutation.js';
import type { InferType } from '../../../zod-utils.js';
import { AnalyticsBaseMutationSchema } from './base-event.mutation.js';

export const AnalyticsMutationProductDetailsViewEventSchema =
  AnalyticsBaseMutationSchema.extend({
    event: z.literal('product-details-view'),
    product: ProductIdentifierSchema,
  });

export type AnalyticsMutationProductDetailsViewEvent = InferType<
  typeof AnalyticsMutationProductDetailsViewEventSchema
>;
