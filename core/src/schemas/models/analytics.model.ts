import type * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';

export const AnalyticsEventSchema = BaseModelSchema.extend({
});

export type AnalyticsEvent = InferType<typeof AnalyticsEventSchema>;