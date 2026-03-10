import type {
  CartFactory,
  CategoryFactory,
  CheckoutFactory,
  ClientFromCapabilities,
  IdentityFactory,
  InventoryFactory,
  OrderFactory,
  OrderSearchFactory,
  PriceFactory,
  ProductAssociationsFactory,
  ProductFactory,
  ProductListFactory,
  ProductReviewsFactory,
  ProductSearchFactory,
  ProfileFactory,
  StoreFactory,
} from '@reactionary/core';
import type { CommercetoolsCapabilities } from '../schema/capabilities.schema.js';
import type { OverridableCapabilityKey } from './capability-descriptors.js';
import type { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import type { CommercetoolsCategoryFactory } from '../factories/category/category.factory.js';
import type { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';
import type { CommercetoolsInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';
import type { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';
import type { CommercetoolsProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import type { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import type { CommercetoolsProductListFactory } from '../factories/product-list/product-list.factory.js';
import type { CommercetoolsProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { CommercetoolsProfileFactory } from '../factories/profile/profile.factory.js';
import type { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';
import type { CommercetoolsCartCapability } from '../capabilities/cart.capability.js';
import type { CommercetoolsCategoryCapability } from '../capabilities/category.capability.js';
import type { CommercetoolsCheckoutCapability } from '../capabilities/checkout.capability.js';
import type { CommercetoolsIdentityCapability } from '../capabilities/identity.capability.js';
import type { CommercetoolsInventoryCapability } from '../capabilities/inventory.capability.js';
import type { CommercetoolsOrderSearchCapability } from '../capabilities/order-search.capability.js';
import type { CommercetoolsOrderCapability } from '../capabilities/order.capability.js';
import type { CommercetoolsPriceCapability } from '../capabilities/price.capability.js';
import type { CommercetoolsProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import type { CommercetoolsProductListCapability } from '../capabilities/product-list.capability.js';
import type { CommercetoolsProductCapability } from '../capabilities/product.capability.js';
import type { CommercetoolsProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import type { CommercetoolsProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { CommercetoolsProfileCapability } from '../capabilities/profile.capability.js';
import type { CommercetoolsStoreCapability } from '../capabilities/store.capability.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends CommercetoolsCapabilities> =
  Omit<T, OverridableCapabilityKey> & {
    [K in OverridableCapabilityKey]?: EnabledCapability<T[K]>;
  };

type ExtractCapabilityFactory<TCapability, TContract, TDefaultFactory> =
  TCapability extends { enabled: true; factory?: infer TFactory }
    ? TFactory extends TContract
      ? TFactory
      : TDefaultFactory
    : TDefaultFactory;

type ExtractCapabilityImplementation<TCapability, TDefaultCapability> =
  TCapability extends { enabled: true; capability?: infer TCapabilityFactory }
    ? TCapabilityFactory extends (...args: any[]) => infer TResolvedCapability
      ? TResolvedCapability
      : TDefaultCapability
    : TDefaultCapability;

type FactoryContractMap = {
  product: ProductFactory;
  productSearch: ProductSearchFactory;
  productAssociations: ProductAssociationsFactory;
  productReviews: ProductReviewsFactory;
  productList: ProductListFactory;
  identity: IdentityFactory;
  cart: CartFactory;
  checkout: CheckoutFactory;
  order: OrderFactory;
  orderSearch: OrderSearchFactory;
  inventory: InventoryFactory;
  price: PriceFactory;
  category: CategoryFactory;
  store: StoreFactory;
  profile: ProfileFactory;
};

type DefaultFactoryMap = {
  product: CommercetoolsProductFactory;
  productSearch: CommercetoolsProductSearchFactory;
  productAssociations: CommercetoolsProductAssociationsFactory;
  productReviews: CommercetoolsProductReviewsFactory;
  productList: CommercetoolsProductListFactory;
  identity: CommercetoolsIdentityFactory;
  cart: CommercetoolsCartFactory;
  checkout: CommercetoolsCheckoutFactory;
  order: CommercetoolsOrderFactory;
  orderSearch: CommercetoolsOrderSearchFactory;
  inventory: CommercetoolsInventoryFactory;
  price: CommercetoolsPriceFactory;
  category: CommercetoolsCategoryFactory;
  store: CommercetoolsStoreFactory;
  profile: CommercetoolsProfileFactory;
};

type ResolvedFactoryMap<T extends CommercetoolsCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityFactory<
    T[K],
    FactoryContractMap[K],
    DefaultFactoryMap[K]
  >;
};

type DefaultCapabilityMap<T extends CommercetoolsCapabilities> = {
  product: CommercetoolsProductCapability<ResolvedFactoryMap<T>['product']>;
  productSearch: CommercetoolsProductSearchCapability<ResolvedFactoryMap<T>['productSearch']>;
  productAssociations: CommercetoolsProductAssociationsCapability<
    ResolvedFactoryMap<T>['productAssociations']
  >;
  productReviews: CommercetoolsProductReviewsCapability<
    ResolvedFactoryMap<T>['productReviews']
  >;
  productList: CommercetoolsProductListCapability<ResolvedFactoryMap<T>['productList']>;
  identity: CommercetoolsIdentityCapability<ResolvedFactoryMap<T>['identity']>;
  cart: CommercetoolsCartCapability<ResolvedFactoryMap<T>['cart']>;
  checkout: CommercetoolsCheckoutCapability<ResolvedFactoryMap<T>['checkout']>;
  order: CommercetoolsOrderCapability<ResolvedFactoryMap<T>['order']>;
  orderSearch: CommercetoolsOrderSearchCapability<ResolvedFactoryMap<T>['orderSearch']>;
  inventory: CommercetoolsInventoryCapability<ResolvedFactoryMap<T>['inventory']>;
  price: CommercetoolsPriceCapability<ResolvedFactoryMap<T>['price']>;
  category: CommercetoolsCategoryCapability<ResolvedFactoryMap<T>['category']>;
  store: CommercetoolsStoreCapability<ResolvedFactoryMap<T>['store']>;
  profile: CommercetoolsProfileCapability<ResolvedFactoryMap<T>['profile']>;
};

type CapabilityImplementationMap<T extends CommercetoolsCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityImplementation<T[K], DefaultCapabilityMap<T>[K]>;
};

type EnabledCapabilityOverrideMap<T extends CommercetoolsCapabilities> = {
  [K in OverridableCapabilityKey as T[K] extends { enabled: true } ? K : never]:
    CapabilityImplementationMap<T>[K];
};

export type CommercetoolsClientFromCapabilities<
  T extends CommercetoolsCapabilities,
> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey
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
