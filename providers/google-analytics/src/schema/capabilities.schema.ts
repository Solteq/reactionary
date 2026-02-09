import { CapabilitiesSchema } from '@reactionary/core';
import type { z } from 'zod';

export const GoogleAnalyticsCapabilitySchema = CapabilitiesSchema.pick({
  analytics: true,
}).partial();

export type GoogleAnalyticsCapability = z.infer<
  typeof GoogleAnalyticsCapabilitySchema
>;
