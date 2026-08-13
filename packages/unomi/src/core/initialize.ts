import {
  PersonalizationProfileSchema,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { UnomiPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import { UnomiAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import {
  UnomiCapabilitiesSchema,
  type UnomiCapabilities,
  type UnomiAnalyticsCapabilityConfig,
  type UnomiPersonalizationProfileCapabilityConfig,
} from '../schema/capabilities.schema.js';
import { UnomiConfigurationSchema, type UnomiConfiguration } from '../schema/configuration.schema.js';
import { resolveCapabilityWithFactory, type UnomiClientFromCapabilities } from './initialize.types.js';

export function withUnomiCapabilities<T extends UnomiCapabilities>(
  configuration: UnomiConfiguration,
  capabilities: T,
) {
  return (cache: Cache, context: RequestContext): UnomiClientFromCapabilities<T> => {
    const config = UnomiConfigurationSchema.parse(configuration);
    const caps = UnomiCapabilitiesSchema.parse(capabilities);
    const client: { analytics?: unknown; personalizationProfile?: unknown } = {};
    const personalizationProfile = capabilities.personalizationProfile as
      | UnomiPersonalizationProfileCapabilityConfig
      | undefined;
    const analytics = capabilities.analytics as UnomiAnalyticsCapabilityConfig | undefined;

    if (caps.analytics?.enabled) {
      client.analytics = analytics?.capability?.({ config })
        ?? new UnomiAnalyticsCapability(cache, context, config);
    }

    if (caps.personalizationProfile?.enabled) {
      client.personalizationProfile = resolveCapabilityWithFactory(
        personalizationProfile,
        {
          factory: new UnomiPersonalizationProfileFactory(PersonalizationProfileSchema),
          capability: (args) => new UnomiPersonalizationProfileCapability(
            config,
            cache,
            context,
            args.factory,
          ),
        },
        (factory) => ({ config, factory }),
      );
    }

    return client as UnomiClientFromCapabilities<T>;
  };
}
