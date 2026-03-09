import * as z from 'zod';
import { BaseMutationSchema } from '../base.mutation.js';
import type { InferType } from '../../../zod-utils.js';
import { OrderSchema } from '../../models/order.model.js';

export const AnalyticsMutationPurchaseEventSchema =
  BaseMutationSchema.extend({
    event: z.literal('purchase'),
    order: OrderSchema
  });

export type AnalyticsMutationPurchaseEvent = InferType<
  typeof AnalyticsMutationPurchaseEventSchema
>;
