import * as z from 'zod';
import type { InferType } from '../../../../zod-utils.js';
import { OriginSchema } from '../../../models/analytics/origin.model.js';
import { BaseMutationSchema } from '../../base.mutation.js';

/**
 * Fields every analytics helper accepts next to its required arguments.
 */
export const AnalyticsEventMutationBaseSchema = BaseMutationSchema.extend({
    origin: OriginSchema.optional().meta({ description: 'Where the visitor encountered the item or surface. Meaningful on product-centred events.' }),
    properties: z.record(z.string(), z.unknown()).optional().meta({ description: 'Storefront-only knowledge such as an experiment variant. Not a channel for product data; providers look that up.' }),
});

export type AnalyticsEventMutationBase = InferType<typeof AnalyticsEventMutationBaseSchema>;
