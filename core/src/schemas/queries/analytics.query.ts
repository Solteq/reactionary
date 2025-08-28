import { z } from 'zod';

export const AnalyticsQuerySchema = z.never().describe('No analytics queries defined yet');

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;