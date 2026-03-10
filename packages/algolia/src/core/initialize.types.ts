import type {
  ClientFromCapabilities,
  ProductSearchFactory,
} from '@reactionary/core';
import type { AlgoliaCapabilities } from '../schema/capabilities.schema.js';
import type { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { AlgoliaAnalyticsCapability } from '../capabilities/analytics.capability.js';
import type { AlgoliaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import type { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';

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

type ProductSearchFactoryFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityFactory<
    T['productSearch'],
    ProductSearchFactory,
    AlgoliaProductSearchFactory
  >;

type ProductSearchCapabilityFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityImplementation<
    T['productSearch'],
    AlgoliaProductSearchCapability<ProductSearchFactoryFor<T>>
  >;

type AnalyticsCapabilityFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityImplementation<T['analytics'], AlgoliaAnalyticsCapability>;

type ProductRecommendationsCapabilityFor<T extends AlgoliaCapabilities> =
  ExtractCapabilityImplementation<
    T['productRecommendations'],
    AlgoliaProductRecommendationsCapability
  >;

export type AlgoliaClientFromCapabilities<T extends AlgoliaCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  'productSearch' | 'analytics' | 'productRecommendations'
> &
  CapabilityOverride<T['productSearch'], 'productSearch', ProductSearchCapabilityFor<T>> &
  CapabilityOverride<T['analytics'], 'analytics', AnalyticsCapabilityFor<T>> &
  CapabilityOverride<
    T['productRecommendations'],
    'productRecommendations',
    ProductRecommendationsCapabilityFor<T>
  >;

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
