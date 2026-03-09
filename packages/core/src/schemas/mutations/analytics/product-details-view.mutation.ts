import * as z from 'zod';
import { ProductIdentifierSchema } from '../../models/identifiers.model.js';
import { BaseMutationSchema } from '../base.mutation.js';
import type { InferType } from '../../../zod-utils.js';

export const AnalyticsMutationProductDetailsViewEventSchema =
  BaseMutationSchema.extend({
    event: z.literal('product-details-view'),
    product: ProductIdentifierSchema,
  });

export type AnalyticsMutationProductDetailsViewEvent = InferType<
  typeof AnalyticsMutationProductDetailsViewEventSchema
>;
