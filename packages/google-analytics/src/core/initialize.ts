import type { Cache, RequestContext } from '@reactionary/core';
import {
  GoogleAnalyticsCapabilitiesSchema,
  type GoogleAnalyticsCapabilities,
} from '../schema/capabilities.schema.js';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';
import { GoogleAnalyticsAnalyticsProvider } from '../providers/analytics.provider.js';
import {
  type GoogleAnalyticsClientFromCapabilities,
  resolveProviderOnlyCapability,
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
      client.analytics = resolveProviderOnlyCapability(
        capabilities.analytics,
        (args) => new GoogleAnalyticsAnalyticsProvider(args.cache, args.context, args.config),
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
