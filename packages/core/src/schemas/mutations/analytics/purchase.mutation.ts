import * as z from 'zod';
import { BaseMutationSchema } from '../base.mutation.js';
import type { InferType } from '../../../zod-utils.js';
import { OrderSchema } from '../../models/order.model.js';
import { AnalyticsBaseMutationSchema } from './base-event.mutation.js';

export const AnalyticsMutationPurchaseEventSchema =
  AnalyticsBaseMutationSchema.extend({
    event: z.literal('purchase'),
    order: OrderSchema
  });

export type AnalyticsMutationPurchaseEvent = InferType<
  typeof AnalyticsMutationPurchaseEventSchema
>;
