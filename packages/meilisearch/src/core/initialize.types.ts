import type {
  ClientFromCapabilities,
  OrderSearchFactory,
  ProductSearchFactory,
} from '@reactionary/core';
import type { MeilisearchCapabilities } from '../schema/capabilities.schema.js';
import type { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MeilisearchOrderSearchCapability } from '../capabilities/order-search.capability.js';
import type { MeilisearchProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import type { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';

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

type ProductSearchCapabilityFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityImplementation<
    T['productSearch'],
    MeilisearchProductSearchCapability<ProductSearchFactoryFor<T>>
  >;

type OrderSearchCapabilityFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityImplementation<
    T['orderSearch'],
    MeilisearchOrderSearchCapability<OrderSearchFactoryFor<T>>
  >;

type ProductRecommendationsCapabilityFor<T extends MeilisearchCapabilities> =
  ExtractCapabilityImplementation<
    T['productRecommendations'],
    MeilisearchProductRecommendationsCapability
  >;

export type MeilisearchClientFromCapabilities<T extends MeilisearchCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  'productSearch' | 'orderSearch' | 'productRecommendations'
> &
  CapabilityOverride<T['productSearch'], 'productSearch', ProductSearchCapabilityFor<T>> &
  CapabilityOverride<T['orderSearch'], 'orderSearch', OrderSearchCapabilityFor<T>> &
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
