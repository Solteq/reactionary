import type {
  ClientFromCapabilities,
  ProductSearchFactory,
} from '@reactionary/core';
import type { AlgoliaCapabilities } from '../schema/capabilities.schema.js';
import type { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { AlgoliaAnalyticsProvider } from '../providers/analytics.provider.js';
import type { AlgoliaProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import type { AlgoliaProductSearchProvider } from '../providers/product-search.provider.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends AlgoliaCapabilities> =
  Omit<T, 'productSearch' | 'analytics' | 'productRecommendations'> & {
    productSearch?: EnabledCapability<T['productSearch']>;
    analytics?: EnabledCapability<T['analytics']>;
    productRecommendations?: EnabledCapability<T['productRecommendations']>;
  };

type ExtractCapabilityFactory<TCapability, TContract, TDefaultFactory> =
  TCapability extends { enabled: true; factory?: infer TFactory }
    ? TFactory extends TContract
      ? TFactory
      : TDefaultFactory
    : TDefaultFactory;

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

type ProductSearchFactoryFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityFactory<
    T['productSearch'],
    ProductSearchFactory,
    AlgoliaProductSearchFactory
  >;

type ProductSearchProviderFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityProvider<
    T['productSearch'],
    AlgoliaProductSearchProvider<ProductSearchFactoryFor<T>>
  >;

type AnalyticsProviderFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityProvider<T['analytics'], AlgoliaAnalyticsProvider>;

type ProductRecommendationsProviderFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityProvider<
    T['productRecommendations'],
    AlgoliaProductRecommendationsProvider
  >;

export type AlgoliaClientFromCapabilities<T extends AlgoliaCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  'productSearch' | 'analytics' | 'productRecommendations'
> &
  CapabilityOverride<T['productSearch'], 'productSearch', ProductSearchProviderFor<T>> &
  CapabilityOverride<T['analytics'], 'analytics', AnalyticsProviderFor<T>> &
  CapabilityOverride<
    T['productRecommendations'],
    'productRecommendations',
    ProductRecommendationsProviderFor<T>
  >;

export function resolveCapabilityProvider<TFactory, TProvider, TProviderArgs>(
  capability:
    | {
        factory?: TFactory;
        provider?: (args: TProviderArgs) => TProvider;
      }
    | undefined,
  defaults: {
    factory: TFactory;
    provider: (args: TProviderArgs) => TProvider;
  },
  buildProviderArgs: (factory: TFactory) => TProviderArgs,
): TProvider {
  const factory = capability?.factory ?? defaults.factory;
  const provider = capability?.provider ?? defaults.provider;

  return provider(buildProviderArgs(factory));
}

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
