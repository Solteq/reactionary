import type { AnalyticsProvider, Cache, RequestContext } from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { GoogleAnalyticsConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const AnalyticsCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  provider: z.unknown().optional(),
});

export const GoogleAnalyticsCapabilitiesSchema = CapabilitiesSchema.pick({
  analytics: true,
})
  .extend({
    analytics: AnalyticsCapabilitySchema.optional(),
  })
  .partial();

export interface GoogleAnalyticsProviderFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: GoogleAnalyticsConfiguration;
}

export interface GoogleAnalyticsAnalyticsCapabilityConfig<
  TProvider extends AnalyticsProvider = AnalyticsProvider,
> {
  enabled: boolean;
  provider?: (args: GoogleAnalyticsProviderFactoryArgs) => TProvider;
}

export type GoogleAnalyticsCapabilities<
  TAnalyticsProvider extends AnalyticsProvider = AnalyticsProvider,
> = {
  analytics?: GoogleAnalyticsAnalyticsCapabilityConfig<TAnalyticsProvider>;
};
