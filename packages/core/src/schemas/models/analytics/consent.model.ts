import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';

export const AnalyticsPurposeSchema = z.enum(['necessary', 'analytics', 'marketing']).meta({ description: 'The purpose an analytics subscriber processes events for. "necessary" is always allowed; the others require granted consent.' });

export const AnalyticsConsentSchema = z.looseObject({
    analytics: z.boolean().meta({ description: 'True if the visitor has granted consent to analytics processing.' }),
    marketing: z.boolean().meta({ description: 'True if the visitor has granted consent to marketing processing.' }),
});

export type AnalyticsPurpose = InferType<typeof AnalyticsPurposeSchema>;
export type AnalyticsConsent = InferType<typeof AnalyticsConsentSchema>;
