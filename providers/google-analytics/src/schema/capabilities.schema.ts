import { CapabilitiesSchema } from '@reactionary/core';
import type { z } from 'zod';

export const GoogleAnalyticsCapabilitiesSchema = CapabilitiesSchema.pick({
  analytics: true,
}).partial();

export type GoogleAnalyticsCapabilities = z.infer<
  typeof GoogleAnalyticsCapabilitiesSchema
>;
