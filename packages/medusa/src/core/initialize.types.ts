import type {
  CartFactory,
  CategoryFactory,
  CheckoutFactory,
  ClientFromCapabilities,
  InventoryFactory,
  OrderFactory,
  OrderSearchFactory,
  PriceFactory,
  ProductAssociationsFactory,
  ProductFactory,
  ProductRecommendationsCapability,
  ProductSearchFactory,
  ProfileFactory,
} from '@reactionary/core';
import type { MedusaCapabilities } from '../schema/capabilities.schema.js';
import type { MedusaCartFactory } from '../factories/cart/cart.factory.js';
import type { MedusaCategoryFactory } from '../factories/category/category.factory.js';
import type { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { MedusaInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { MedusaOrderFactory } from '../factories/order/order.factory.js';
import type { MedusaOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MedusaPriceFactory } from '../factories/price/price.factory.js';
import type { MedusaProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import type { MedusaProductFactory } from '../factories/product/product.factory.js';
import type { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MedusaProfileFactory } from '../factories/profile/profile.factory.js';
import type { MedusaCartCapability } from '../capabilities/cart.capability.js';
import type { MedusaCategoryCapability } from '../capabilities/category.capability.js';
import type { MedusaCheckoutCapability } from '../capabilities/checkout.capability.js';
import type { MedusaInventoryCapability } from '../capabilities/inventory.capability.js';
import type { MedusaOrderCapability } from '../capabilities/order.capability.js';
import type { MedusaOrderSearchCapability } from '../capabilities/order-search.capability.js';
import type { MedusaPriceCapability } from '../capabilities/price.capability.js';
import type { MedusaProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import type { MedusaProductCapability } from '../capabilities/product.capability.js';
import type { MedusaProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { MedusaProfileCapability } from '../capabilities/profile.capability.js';
import type { MedusaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import type { MedusaIdentityCapability } from '../capabilities/identity.capability.js';

type OverridableCapabilityKey =
  | 'product'
  | 'productSearch'
  | 'cart'
  | 'checkout'
  | 'category'
  | 'price'
  | 'order'
  | 'orderSearch'
  | 'inventory'
  | 'profile'
  | 'productAssociations';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends MedusaCapabilities> =
  Omit<T, OverridableCapabilityKey | 'productRecommendations'> & {
    [K in OverridableCapabilityKey]?: EnabledCapability<T[K]>;
  } & {
    productRecommendations?: EnabledCapability<T['productRecommendations']>;
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
  checkout: CheckoutFactory;
  category: CategoryFactory;
  price: PriceFactory;
  order: OrderFactory;
  orderSearch: OrderSearchFactory;
  inventory: InventoryFactory;
  profile: ProfileFactory;
  productAssociations: ProductAssociationsFactory;
};

type DefaultFactoryMap = {
  product: MedusaProductFactory;
  productSearch: MedusaProductSearchFactory;
  cart: MedusaCartFactory;
  checkout: MedusaCheckoutFactory;
  category: MedusaCategoryFactory;
  price: MedusaPriceFactory;
  order: MedusaOrderFactory;
  orderSearch: MedusaOrderSearchFactory;
  inventory: MedusaInventoryFactory;
  profile: MedusaProfileFactory;
  productAssociations: MedusaProductAssociationsFactory;
};

type ResolvedFactoryMap<T extends MedusaCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityFactory<
    T[K],
    FactoryContractMap[K],
    DefaultFactoryMap[K]
  >;
};

type DefaultCapabilityMap<T extends MedusaCapabilities> = {
  product: MedusaProductCapability<ResolvedFactoryMap<T>['product']>;
  productSearch: MedusaProductSearchCapability<ResolvedFactoryMap<T>['productSearch']>;
  cart: MedusaCartCapability<ResolvedFactoryMap<T>['cart']>;
  checkout: MedusaCheckoutCapability<ResolvedFactoryMap<T>['checkout']>;
  category: MedusaCategoryCapability<ResolvedFactoryMap<T>['category']>;
  price: MedusaPriceCapability<ResolvedFactoryMap<T>['price']>;
  order: MedusaOrderCapability<ResolvedFactoryMap<T>['order']>;
  orderSearch: MedusaOrderSearchCapability<ResolvedFactoryMap<T>['orderSearch']>;
  inventory: MedusaInventoryCapability<ResolvedFactoryMap<T>['inventory']>;
  profile: MedusaProfileCapability<ResolvedFactoryMap<T>['profile']>;
  productAssociations: MedusaProductAssociationsCapability<
    ResolvedFactoryMap<T>['productAssociations']
  >;
  identity: MedusaIdentityCapability;
  productRecommendations: MedusaProductRecommendationsCapability;
};

type CapabilityImplementationMap<T extends MedusaCapabilities> = {
  [K in OverridableCapabilityKey | 'productRecommendations' | 'identity']: ExtractCapabilityImplementation<
    T[K],
    DefaultCapabilityMap<T>[K]
  >;
};

type EnabledCapabilityOverrideMap<T extends MedusaCapabilities> = {
  [K in OverridableCapabilityKey | 'productRecommendations' | 'identity' as T[K] extends {
    enabled: true;
  }
    ? K
    : never]: CapabilityImplementationMap<T>[K];
};

export type MedusaClientFromCapabilities<T extends MedusaCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey | 'productRecommendations' | 'identity'
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
