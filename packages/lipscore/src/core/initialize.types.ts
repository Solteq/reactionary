import type {
  ClientFromCapabilities,
  ProductReviewsFactory,
} from '@reactionary/core';
import type { LipscoreCapabilities } from '../schema/capabilities.schema.js';
import type { LipscoreProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { LipscoreProductReviewsCapability } from '../capabilities/product-reviews.capability.js';

type EnabledCapability<TCapability> = TCapability extends { enabled: true }
  ? true
  : false;

type NormalizeConfiguredCapabilities<T extends LipscoreCapabilities> = Omit<
  T,
  'productReviews'
> & {
  productReviews?: EnabledCapability<T['productReviews']>;
};

type ExtractCapabilityFactory<TCapability, TContract, TDefaultFactory> =
  TCapability extends { enabled: true; factory?: infer TFactory }
    ? TFactory extends TContract
      ? TFactory
      : TDefaultFactory
    : TDefaultFactory;

type ExtractCapabilityImplementation<TCapability, TDefaultCapability> =
  TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
    ? TCapabilityFactory extends (
        ...args: unknown[]
      ) => infer TResolvedCapability
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

type ProductReviewsFactoryFor<T extends LipscoreCapabilities> =
  ExtractCapabilityFactory<
    T['productReviews'],
    ProductReviewsFactory,
    LipscoreProductReviewsFactory
  >;

type ProductReviewsCapabilityFor<T extends LipscoreCapabilities> =
  ExtractCapabilityImplementation<
    T['productReviews'],
    LipscoreProductReviewsCapability<ProductReviewsFactoryFor<T>>
  >;

export type LipscoreClientFromCapabilities<T extends LipscoreCapabilities> =
  Omit<
    ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
    'productReviews'
  > &
    CapabilityOverride<
      T['productReviews'],
      'productReviews',
      ProductReviewsCapabilityFor<T>
    >;

export function resolveCapabilityWithFactory<
  TFactory,
  TResolvedCapability,
  TCapabilityArgs,
>(
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
  return capabilityFactory(buildCapabilityArgs(factory as TFactory));
}
