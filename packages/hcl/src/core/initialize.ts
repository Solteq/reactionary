import type { Cache, RequestContext } from '@reactionary/core';
import {
  HclCapabilitiesSchema,
  type HclCapabilities,
} from '../schema/capabilities.schema.js';
import {
  HclConfigurationSchema,
  type HclConfiguration,
} from '../schema/configuration.schema.js';
import { type HclClientFromCapabilities } from './initialize.types.js';

export function withHclCapabilities<T extends HclCapabilities>(
  configuration: HclConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): HclClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const config = HclConfigurationSchema.parse(configuration);
    const caps = HclCapabilitiesSchema.parse(capabilities);

    // TODO: Implement capabilities as they are added to the HCL provider.
    // Follow the pattern from other providers (e.g. medusa) using resolveCapabilityWithFactory.

    void cache;
    void context;
    void config;
    void caps;

    return client as HclClientFromCapabilities<T>;
  };
}
