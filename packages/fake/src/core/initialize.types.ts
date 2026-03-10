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
  ProductReviewsFactory,
  ProductSearchFactory,
  ProfileFactory,
  StoreFactory,
} from '@reactionary/core';
import type { FakeCapabilities } from '../schema/capabilities.schema.js';
import type { FakeCartFactory } from '../factories/cart/cart.factory.js';
import type { FakeCategoryFactory } from '../factories/category/category.factory.js';
import type { FakeCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { FakeIdentityFactory } from '../factories/identity/identity.factory.js';
import type { FakeInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { FakeOrderFactory } from '../factories/order/order.factory.js';
import type { FakeOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { FakePriceFactory } from '../factories/price/price.factory.js';
import type { FakeProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import type { FakeProductFactory } from '../factories/product/product.factory.js';
import type { FakeProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type { FakeProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { FakeProfileFactory } from '../factories/profile/profile.factory.js';
import type { FakeStoreFactory } from '../factories/store/store.factory.js';
import type { FakeCartCapability } from '../capabilities/cart.capability.js';
import type { FakeCategoryCapability } from '../capabilities/category.capability.js';
import type { FakeCheckoutCapability } from '../capabilities/checkout.capability.js';
import type { FakeIdentityCapability } from '../capabilities/identity.capability.js';
import type { FakeInventoryCapability } from '../capabilities/inventory.capability.js';
import type { FakeOrderCapability } from '../capabilities/order.capability.js';
import type { FakeOrderSearchCapability } from '../capabilities/order-search.capability.js';
import type { FakePriceCapability } from '../capabilities/price.capability.js';
import type { FakeProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import type { FakeProductCapability } from '../capabilities/product.capability.js';
import type { FakeProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import type { FakeProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { FakeProfileCapability } from '../capabilities/profile.capability.js';
import type { FakeStoreCapability } from '../capabilities/store.capability.js';

type FakeCapabilityKey = keyof FakeCapabilities;

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey]?: EnabledCapability<T[K]>;
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
  identity: IdentityFactory;
  category: CategoryFactory;
  cart: CartFactory;
  inventory: InventoryFactory;
  store: StoreFactory;
  price: PriceFactory;
  checkout: CheckoutFactory;
  order: OrderFactory;
  orderSearch: OrderSearchFactory;
  profile: ProfileFactory;
  productReviews: ProductReviewsFactory;
  productAssociations: ProductAssociationsFactory;
};

type DefaultFactoryMap = {
  product: FakeProductFactory;
  productSearch: FakeProductSearchFactory;
  identity: FakeIdentityFactory;
  category: FakeCategoryFactory;
  cart: FakeCartFactory;
  inventory: FakeInventoryFactory;
  store: FakeStoreFactory;
  price: FakePriceFactory;
  checkout: FakeCheckoutFactory;
  order: FakeOrderFactory;
  orderSearch: FakeOrderSearchFactory;
  profile: FakeProfileFactory;
  productReviews: FakeProductReviewsFactory;
  productAssociations: FakeProductAssociationsFactory;
};

type ResolvedFactoryMap<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey]: ExtractCapabilityFactory<
    T[K],
    FactoryContractMap[K],
    DefaultFactoryMap[K]
  >;
};

type DefaultCapabilityMap<T extends FakeCapabilities> = {
  product: FakeProductCapability<ResolvedFactoryMap<T>['product']>;
  productSearch: FakeProductSearchCapability<ResolvedFactoryMap<T>['productSearch']>;
  identity: FakeIdentityCapability<ResolvedFactoryMap<T>['identity']>;
  category: FakeCategoryCapability<ResolvedFactoryMap<T>['category']>;
  cart: FakeCartCapability<ResolvedFactoryMap<T>['cart']>;
  inventory: FakeInventoryCapability<ResolvedFactoryMap<T>['inventory']>;
  store: FakeStoreCapability<ResolvedFactoryMap<T>['store']>;
  price: FakePriceCapability<ResolvedFactoryMap<T>['price']>;
  checkout: FakeCheckoutCapability<ResolvedFactoryMap<T>['checkout']>;
  order: FakeOrderCapability<ResolvedFactoryMap<T>['order']>;
  orderSearch: FakeOrderSearchCapability<ResolvedFactoryMap<T>['orderSearch']>;
  profile: FakeProfileCapability<ResolvedFactoryMap<T>['profile']>;
  productReviews: FakeProductReviewsCapability<ResolvedFactoryMap<T>['productReviews']>;
  productAssociations: FakeProductAssociationsCapability<
    ResolvedFactoryMap<T>['productAssociations']
  >;
};

type CapabilityImplementationMap<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey]: ExtractCapabilityImplementation<T[K], DefaultCapabilityMap<T>[K]>;
};

type EnabledCapabilityOverrideMap<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey as T[K] extends { enabled: true } ? K : never]:
    CapabilityImplementationMap<T>[K];
};

export type FakeClientFromCapabilities<T extends FakeCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  FakeCapabilityKey
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
