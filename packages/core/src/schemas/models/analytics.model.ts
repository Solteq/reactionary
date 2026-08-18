import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';

export const AnalyticsEventSchema = BaseModelSchema.extend({
});

export const AnalyticsOutcomeSchema = z.enum(['accepted', 'ignored', 'rejected']);
export const AnalyticsProviderOutcomeSchema = z.object({
    provider: z.string(),
    outcome: AnalyticsOutcomeSchema,
});
export const AnalyticsResultSchema = BaseModelSchema.extend({
    outcomes: z.array(AnalyticsProviderOutcomeSchema),
});

export type AnalyticsEvent = InferType<typeof AnalyticsEventSchema>;
export type AnalyticsResult = InferType<typeof AnalyticsResultSchema>;