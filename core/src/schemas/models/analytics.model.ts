import { z } from 'zod';
import { BaseModelSchema } from './common/base.model';

export const AnalyticsEventSchema = BaseModelSchema.extend({
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;