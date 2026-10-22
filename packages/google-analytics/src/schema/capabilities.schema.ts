import type { AnalyticsProvider, Cache, RequestContext } from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { GoogleAnalyticsConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const AnalyticsCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  capability: z.unknown().optional(),
});

export const GoogleAnalyticsCapabilitiesSchema = CapabilitiesSchema.pick({
  analytics: true,
})
  .extend({
    analytics: AnalyticsCapabilitySchema.optional(),
  })
  .partial();

export interface GoogleAnalyticsCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: GoogleAnalyticsConfiguration;
}

export interface GoogleAnalyticsAnalyticsCapabilityConfig<
  TCapability extends AnalyticsProvider = AnalyticsProvider,
> {
  enabled: boolean;
  capability?: (args: GoogleAnalyticsCapabilityFactoryArgs) => TCapability;
}

export type GoogleAnalyticsCapabilities<
  TAnalyticsCapability extends AnalyticsProvider = AnalyticsProvider,
> = {
  analytics?: GoogleAnalyticsAnalyticsCapabilityConfig<TAnalyticsCapability>;
};
