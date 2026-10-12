import type { Cache, RequestContext } from '@reactionary/core';
import {
  CommercetoolsCapabilitiesSchema,
  type CommercetoolsCapabilities,
} from '../schema/capabilities.schema.js';
import {
  CommercetoolsConfigurationSchema,
  type CommercetoolsConfiguration,
} from '../schema/configuration.schema.js';
import { CommercetoolsAPI } from './client.js';
import {
  capabilityDescriptors,
  capabilityKeys,
} from './capability-descriptors.js';
import {
  type CommercetoolsClientFromCapabilities,
  resolveCapabilityWithFactory,
} from './initialize.types.js';

export function withCommercetoolsCapabilities<
  T extends CommercetoolsCapabilities,
>(configuration: CommercetoolsConfiguration, capabilities: T) {
  return (
    cache: Cache,
    context: RequestContext,
  ): CommercetoolsClientFromCapabilities<T> => {
    const client: any = {};
    const config = CommercetoolsConfigurationSchema.parse(configuration);
    const caps = CommercetoolsCapabilitiesSchema.parse(capabilities);
    const commercetoolsApi = new CommercetoolsAPI(config, context);

    const buildCapabilityArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config,
      commercetoolsApi,
      factory,
    });

    for (const key of capabilityKeys) {
      const descriptor = capabilityDescriptors[key];
      if (!descriptor.isEnabled(caps)) {
        continue;
      }

      client[key] = resolveCapabilityWithFactory(
        descriptor.getOverride(capabilities),
        {
          factory: descriptor.createDefaultFactory(),
          capability: descriptor.createDefaultCapability,
        },
        buildCapabilityArgs,
      );
    }

    return client;
  };
}
