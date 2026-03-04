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
import type {
  CommercetoolsProviders,
  FactoryOverrides,
  ProviderFactoryMap,
} from './capability-registry.js';
import {
  createProviderFactories,
  resolveFactories,
} from './capability-registry.js';

type EnabledProviders<
  C extends CommercetoolsCapabilities,
  P extends Record<string, unknown>
> = {
  [K in keyof P as K extends keyof C ? (C[K] extends true ? K : never) : never]: P[K];
};

function buildEnabledProviders<
  C extends CommercetoolsCapabilities,
  P extends Record<string, unknown>
>(
  typedCapabilities: C,
  runtimeCapabilities: CommercetoolsCapabilities,
  providers: ProviderFactoryMap<P>
): EnabledProviders<C, P> {
  const client: Partial<P> = {};

  for (const key of Object.keys(providers) as Array<keyof P>) {
    if (runtimeCapabilities[key as keyof CommercetoolsCapabilities]) {
      client[key] = providers[key]();
    }
  }

  void typedCapabilities;
  return client as unknown as EnabledProviders<C, P>;
}

export function withCommercetoolsCapabilities<
  C extends CommercetoolsCapabilities,
  F extends FactoryOverrides = {}
>(
  configuration: CommercetoolsConfiguration,
  capabilities: C,
  options?: { factories?: F }
) {
  return (cache: Cache, context: RequestContext) => {
    const config = CommercetoolsConfigurationSchema.parse(configuration);
    const runtimeCapabilities = CommercetoolsCapabilitiesSchema.parse(capabilities);
    const commercetoolsApi = new CommercetoolsAPI(config, context);
    const factories = resolveFactories(options?.factories);
    const providers = createProviderFactories(
      config,
      cache,
      context,
      commercetoolsApi,
      factories
    ) satisfies ProviderFactoryMap<CommercetoolsProviders<F>>;

    return buildEnabledProviders(capabilities, runtimeCapabilities, providers);
  };
}
