import type { Cache, RequestContext } from '@reactionary/core';
import {
  GoogleAnalyticsCapabilitiesSchema,
  type GoogleAnalyticsCapabilities,
} from '../schema/capabilities.schema.js';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';
import { GoogleAnalyticsAnalyticsCapability } from '../capabilities/analytics.capability.js';
import {
  type GoogleAnalyticsClientFromCapabilities,
  resolveDirectCapability,
} from './initialize.types.js';

export function withGoogleAnalyticsCapabilities<
  T extends GoogleAnalyticsCapabilities,
>(configuration: GoogleAnalyticsConfiguration, capabilities: T) {
  return (
    cache: Cache,
    context: RequestContext,
  ): GoogleAnalyticsClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const caps = GoogleAnalyticsCapabilitiesSchema.parse(capabilities);

    if (caps.analytics?.enabled) {
      client.analytics = resolveDirectCapability(
        capabilities.analytics,
        (args) => new GoogleAnalyticsAnalyticsCapability(args.cache, args.context, args.config),
        {
          cache,
          context,
          config: configuration,
        },
      );
    }

    return client;
  };
}

// Backward-compatibility alias.
export const googleAnalyticsCapabilities = withGoogleAnalyticsCapabilities;
