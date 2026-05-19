import type { ClientFromCapabilities } from '@reactionary/core';
import type { HclCapabilities } from '../schema/capabilities.schema.js';
import type { HclCartCapability } from '../capabilities/cart.capability.js';
import type { HclCheckoutCapability } from '../capabilities/checkout.capability.js';
import type { HclProductCapability } from '../capabilities/product.capability.js';
import type { HclCategoryCapability } from '../capabilities/category.capability.js';
import type { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { HclPriceCapability } from '../capabilities/price.capability.js';
import type { HclInventoryCapability } from '../capabilities/inventory.capability.js';
import type { HclIdentityCapability } from '../capabilities/identity.capability.js';

type OverridableCapabilityKey =
  | 'product'
  | 'productSearch'
  | 'cart'
  | 'checkout'
  | 'category'
  | 'price'
  | 'inventory'
  | 'identity';

type EnabledCapability<TCapability> = TCapability extends { enabled: true }
  ? true
  : false;

type NormalizeConfiguredCapabilities<T extends HclCapabilities> = {
  [K in OverridableCapabilityKey]?: EnabledCapability<T[K]>;
};

type ExtractCapabilityImplementation<TCapability, TDefaultCapability> =
  TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
    ? TCapabilityFactory extends (
        ...args: unknown[]
      ) => infer TResolvedCapability
      ? TResolvedCapability
      : TDefaultCapability
    : TDefaultCapability;

// Default capability types for each overridable key.
type DefaultCapabilityMap = {
  product: HclProductCapability;
  productSearch: HclProductSearchCapability;
  cart: HclCartCapability;
  checkout: HclCheckoutCapability;
  category: HclCategoryCapability;
  price: HclPriceCapability;
  inventory: HclInventoryCapability;
  identity: HclIdentityCapability;
};

type CapabilityImplementationMap<T extends HclCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityImplementation<
    T[K],
    DefaultCapabilityMap[K]
  >;
};

type EnabledCapabilityOverrideMap<T extends HclCapabilities> = {
  [K in OverridableCapabilityKey as T[K] extends { enabled: true }
    ? K
    : never]: CapabilityImplementationMap<T>[K];
};

export type HclClientFromCapabilities<T extends HclCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey
> &
  EnabledCapabilityOverrideMap<T>;

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
  return capabilityFactory(buildCapabilityArgs(factory));
}
