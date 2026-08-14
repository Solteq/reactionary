import type {
  AnalyticsCapability,
  ClientFromCapabilities,
  PersonalizationProfileFactory,
} from '@reactionary/core';
import type { UnomiPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import type { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import type { UnomiCapabilities } from '../schema/capabilities.schema.js';

type OverridableCapabilityKey = 'analytics' | 'personalizationProfile';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends UnomiCapabilities> =
  Omit<T, OverridableCapabilityKey> & {
    [K in OverridableCapabilityKey]?: EnabledCapability<T[K]>;
  };

type ExtractCapabilityFactory<TCapability> =
  TCapability extends { enabled: true; factory?: infer TFactory }
    ? TFactory extends PersonalizationProfileFactory
      ? TFactory
      : UnomiPersonalizationProfileFactory
    : UnomiPersonalizationProfileFactory;

type ExtractCapabilityImplementation<TCapability, TDefaultCapability> =
  TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
    ? TCapabilityFactory extends (...args: unknown[]) => infer TResolvedCapability
      ? TResolvedCapability
      : TDefaultCapability
    : TDefaultCapability;

type ResolvedFactoryMap<T extends UnomiCapabilities> = {
  personalizationProfile: ExtractCapabilityFactory<T['personalizationProfile']>;
};

type DefaultCapabilityMap<T extends UnomiCapabilities> = {
  analytics: AnalyticsCapability;
  personalizationProfile: UnomiPersonalizationProfileCapability<
    ResolvedFactoryMap<T>['personalizationProfile']
  >;
};

type CapabilityImplementationMap<T extends UnomiCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityImplementation<
    T[K],
    DefaultCapabilityMap<T>[K]
  >;
};

type EnabledCapabilityOverrideMap<T extends UnomiCapabilities> = {
  [K in OverridableCapabilityKey as T[K] extends { enabled: true }
    ? K
    : never]: CapabilityImplementationMap<T>[K];
};

export type UnomiClientFromCapabilities<T extends UnomiCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey
> & EnabledCapabilityOverrideMap<T>;

export function resolveCapabilityWithFactory<TFactory, TResolvedCapability, TCapabilityArgs>(
  capability:
    | {
        factory?: TFactory;
        capability?: (args: TCapabilityArgs) => TResolvedCapability;
      }
    | undefined,
  defaults: {
    factory: TFactory;
    capability: (args: TCapabilityArgs) => TResolvedCapability;
  },
  buildCapabilityArgs: (factory: TFactory) => TCapabilityArgs,
): TResolvedCapability {
  const factory = capability?.factory ?? defaults.factory;
  const capabilityFactory = capability?.capability ?? defaults.capability;
  return capabilityFactory(buildCapabilityArgs(factory));
}
