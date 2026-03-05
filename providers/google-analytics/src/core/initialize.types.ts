import type { ClientFromCapabilities } from '@reactionary/core';
import type { GoogleAnalyticsCapabilities } from '../schema/capabilities.schema.js';
import type { GoogleAnalyticsAnalyticsProvider } from '../providers/analytics.provider.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends GoogleAnalyticsCapabilities> =
  Omit<T, 'analytics'> & {
    analytics?: EnabledCapability<T['analytics']>;
  };

type ExtractCapabilityProvider<TCapability, TDefaultProvider> =
  TCapability extends { enabled: true; provider?: infer TProviderFactory }
    ? TProviderFactory extends (...args: unknown[]) => infer TProvider
      ? TProvider
      : TDefaultProvider
    : TDefaultProvider;

type CapabilityOverride<
  TCapability,
  TKey extends string,
  TProvider,
> = TCapability extends { enabled: true }
  ? { [K in TKey]: TProvider }
  : Record<never, never>;

type AnalyticsProviderFor<T extends GoogleAnalyticsCapabilities> =
  ExtractCapabilityProvider<T['analytics'], GoogleAnalyticsAnalyticsProvider>;

export type GoogleAnalyticsClientFromCapabilities<
  T extends GoogleAnalyticsCapabilities,
> = Omit<ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>, 'analytics'> &
  CapabilityOverride<T['analytics'], 'analytics', AnalyticsProviderFor<T>>;

export function resolveProviderOnlyCapability<TProvider, TProviderArgs>(
  capability:
    | {
        provider?: (args: TProviderArgs) => TProvider;
      }
    | undefined,
  defaultProvider: (args: TProviderArgs) => TProvider,
  args: TProviderArgs,
): TProvider {
  const provider = capability?.provider ?? defaultProvider;
  return provider(args);
}
