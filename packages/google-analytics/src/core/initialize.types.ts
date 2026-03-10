import type { ClientFromCapabilities } from '@reactionary/core';
import type { GoogleAnalyticsCapabilities } from '../schema/capabilities.schema.js';
import type { GoogleAnalyticsAnalyticsCapability } from '../capabilities/analytics.capability.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends GoogleAnalyticsCapabilities> =
  Omit<T, 'analytics'> & {
    analytics?: EnabledCapability<T['analytics']>;
  };

type ExtractCapabilityImplementation<TCapability, TDefaultCapability> =
  TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
    ? TCapabilityFactory extends (...args: unknown[]) => infer TResolvedCapability
      ? TResolvedCapability
      : TDefaultCapability
    : TDefaultCapability;

type CapabilityOverride<
  TCapability,
  TKey extends string,
  TResolvedCapability,
> = TCapability extends { enabled: true }
  ? { [K in TKey]: TResolvedCapability }
  : Record<never, never>;

type AnalyticsCapabilityFor<T extends GoogleAnalyticsCapabilities> =
  ExtractCapabilityImplementation<T['analytics'], GoogleAnalyticsAnalyticsCapability>;

export type GoogleAnalyticsClientFromCapabilities<
  T extends GoogleAnalyticsCapabilities,
> = Omit<ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>, 'analytics'> &
  CapabilityOverride<T['analytics'], 'analytics', AnalyticsCapabilityFor<T>>;

export function resolveDirectCapability<TResolvedCapability, TCapabilityArgs>(
  capability:
    | {
        capability?: (args: TCapabilityArgs) => TResolvedCapability;
      }
    | undefined,
  defaultCapability: (args: TCapabilityArgs) => TResolvedCapability,
  args: TCapabilityArgs,
): TResolvedCapability {
  const capabilityFactory = capability?.capability ?? defaultCapability;
  return capabilityFactory(args);
}
