import { z } from 'zod';
import { BaseModelSchema } from './base.model';

export const AnalyticsEventSchema = BaseModelSchema.extend({
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;