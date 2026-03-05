import type {
  ClientFromCapabilities,
  OrderSearchFactory,
  ProductSearchFactory,
} from '@reactionary/core';
import type { MeilisearchCapabilities } from '../schema/capabilities.schema.js';
import type { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MeilisearchOrderSearchProvider } from '../providers/order-search.provider.js';
import type { MeilisearchProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import type { MeilisearchSearchProvider } from '../providers/product-search.provider.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends MeilisearchCapabilities> =
  Omit<T, 'productSearch' | 'orderSearch' | 'productRecommendations'> & {
    productSearch?: EnabledCapability<T['productSearch']>;
    orderSearch?: EnabledCapability<T['orderSearch']>;
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

type ProductSearchFactoryFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityFactory<
    T['productSearch'],
    ProductSearchFactory,
    MeilisearchProductSearchFactory
  >;

type OrderSearchFactoryFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityFactory<
    T['orderSearch'],
    OrderSearchFactory,
    MeilisearchOrderSearchFactory
  >;

type ProductSearchProviderFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityProvider<
    T['productSearch'],
    MeilisearchSearchProvider<ProductSearchFactoryFor<T>>
  >;

type OrderSearchProviderFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityProvider<
    T['orderSearch'],
    MeilisearchOrderSearchProvider<OrderSearchFactoryFor<T>>
  >;

type ProductRecommendationsProviderFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityProvider<
    T['productRecommendations'],
    MeilisearchProductRecommendationsProvider
  >;

export type MeilisearchClientFromCapabilities<T extends MeilisearchCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  'productSearch' | 'orderSearch' | 'productRecommendations'
> &
  CapabilityOverride<T['productSearch'], 'productSearch', ProductSearchProviderFor<T>> &
  CapabilityOverride<T['orderSearch'], 'orderSearch', OrderSearchProviderFor<T>> &
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
