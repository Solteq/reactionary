import { z } from 'zod';
import { BaseModelSchema } from './base.model';

export const AnalyticsEventSchema = BaseModelSchema.extend({
}).describe('Analytics event for tracking user interactions and behaviors');

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;