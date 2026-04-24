import type {
  CartFactory,
  CategoryFactory,
  ClientFromCapabilities,
  InventoryFactory,
  PriceFactory,
  ProductFactory,
  ProductSearchFactory,
} from '@reactionary/core';
import type { MagentoCapabilities } from '../schema/capabilities.schema.js';
import type { MagentoCartFactory } from '../factories/cart/cart.factory.js';
import type { MagentoCategoryFactory } from '../factories/category/category.factory.js';
import type { MagentoInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { MagentoPriceFactory } from '../factories/price/price.factory.js';
import type { MagentoProductFactory } from '../factories/product/product.factory.js';
import type { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MagentoCartCapability } from '../capabilities/cart.capability.js';
import type { MagentoCategoryCapability } from '../capabilities/category.capability.js';
import type { MagentoIdentityCapability } from '../capabilities/identity.capability.js';
import type { MagentoInventoryCapability } from '../capabilities/inventory.capability.js';
import type { MagentoPriceCapability } from '../capabilities/price.capability.js';
import type { MagentoProductCapability } from '../capabilities/product.capability.js';
import type { MagentoProductSearchCapability } from '../capabilities/product-search.capability.js';

type OverridableCapabilityKey =
  | 'product'
  | 'productSearch'
  | 'cart'
  | 'category'
  | 'price'
  | 'inventory';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends MagentoCapabilities> =
  Omit<T, OverridableCapabilityKey | 'identity'> & {
    [K in OverridableCapabilityKey]?: EnabledCapability<T[K]>;
  } & {
    identity?: EnabledCapability<T['identity']>;
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

type FactoryContractMap = {
  product: ProductFactory;
  productSearch: ProductSearchFactory;
  cart: CartFactory;
  category: CategoryFactory;
  price: PriceFactory;
  inventory: InventoryFactory;
};

type DefaultFactoryMap = {
  product: MagentoProductFactory;
  productSearch: MagentoProductSearchFactory;
  cart: MagentoCartFactory;
  category: MagentoCategoryFactory;
  price: MagentoPriceFactory;
  inventory: MagentoInventoryFactory;
};

type ResolvedFactoryMap<T extends MagentoCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityFactory<
    T[K],
    FactoryContractMap[K],
    DefaultFactoryMap[K]
  >;
};

type DefaultCapabilityMap<T extends MagentoCapabilities> = {
  product: MagentoProductCapability<ResolvedFactoryMap<T>['product']>;
  productSearch: MagentoProductSearchCapability<ResolvedFactoryMap<T>['productSearch']>;
  cart: MagentoCartCapability<ResolvedFactoryMap<T>['cart']>;
  category: MagentoCategoryCapability<ResolvedFactoryMap<T>['category']>;
  price: MagentoPriceCapability<ResolvedFactoryMap<T>['price']>;
  inventory: MagentoInventoryCapability<ResolvedFactoryMap<T>['inventory']>;
  identity: MagentoIdentityCapability;
};

type CapabilityImplementationMap<T extends MagentoCapabilities> = {
  [K in OverridableCapabilityKey | 'identity']: ExtractCapabilityImplementation<
    T[K],
    DefaultCapabilityMap<T>[K]
  >;
};

type EnabledCapabilityOverrideMap<T extends MagentoCapabilities> = {
  [K in OverridableCapabilityKey | 'identity' as T[K] extends {
    enabled: true;
  }
    ? K
    : never]: CapabilityImplementationMap<T>[K];
};

export type MagentoClientFromCapabilities<T extends MagentoCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey | 'identity'
> &
  EnabledCapabilityOverrideMap<T>;

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
