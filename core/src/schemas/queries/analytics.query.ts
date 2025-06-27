import { z } from 'zod';

export const AnalyticsQuerySchema = z.union([]);

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;