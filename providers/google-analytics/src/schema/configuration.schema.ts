import * as z from 'zod';

export const GoogleAnalyticsConfigurationSchema = z.looseObject({
    url: z.string(),
    measurementId: z.string(),
    apiSecret: z.string()
});

export type GoogleAnalyticsConfiguration = z.infer<typeof GoogleAnalyticsConfigurationSchema>;
