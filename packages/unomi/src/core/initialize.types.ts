import type {
  PersonalizationProfileFactory,
} from '@reactionary/core';
import type { AnalyticsCapability } from '@reactionary/core';
import type { UnomiCapabilities } from '../schema/capabilities.schema.js';
import type { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import type { UnomiPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';

type ExtractFactory<TCapability> = TCapability extends { enabled: true; factory?: infer TFactory }
  ? TFactory extends PersonalizationProfileFactory ? TFactory : UnomiPersonalizationProfileFactory
  : UnomiPersonalizationProfileFactory;

type ExtractCapability<TCapability> = TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
  ? TCapabilityFactory extends (...args: never[]) => infer TResolvedCapability
    ? TResolvedCapability
    : UnomiPersonalizationProfileCapability
  : UnomiPersonalizationProfileCapability;

export type UnomiClientFromCapabilities<T extends UnomiCapabilities> =
  (T['analytics'] extends { enabled: true } ? { analytics: AnalyticsCapability } : Record<string, never>) &
  (T['personalizationProfile'] extends { enabled: true }
    ? { personalizationProfile: ExtractCapability<T['personalizationProfile']> }
    : Record<string, never>);

export function resolveCapabilityWithFactory<TFactory, TResolvedCapability, TArgs>(
  capability: { factory?: TFactory; capability?: (args: TArgs) => TResolvedCapability } | undefined,
  defaults: { factory: TFactory; capability: (args: TArgs) => TResolvedCapability },
  buildArgs: (factory: TFactory) => TArgs,
): TResolvedCapability {
  const factory = capability?.factory ?? defaults.factory;
  return (capability?.capability ?? defaults.capability)(buildArgs(factory));
}

export type UnomiPersonalizationProfileFactoryFor<T extends UnomiCapabilities> =
  ExtractFactory<T['personalizationProfile']>;
