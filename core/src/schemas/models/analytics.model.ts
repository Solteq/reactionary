import type { z } from 'zod';
import { BaseModelSchema } from './base.model.js';

export const AnalyticsEventSchema = BaseModelSchema.extend({
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;