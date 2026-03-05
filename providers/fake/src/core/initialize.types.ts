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
import type { FakeCartProvider } from '../providers/cart.provider.js';
import type { FakeCategoryProvider } from '../providers/category.provider.js';
import type { FakeCheckoutProvider } from '../providers/checkout.provider.js';
import type { FakeIdentityProvider } from '../providers/identity.provider.js';
import type { FakeInventoryProvider } from '../providers/inventory.provider.js';
import type { FakeOrderProvider } from '../providers/order.provider.js';
import type { FakeOrderSearchProvider } from '../providers/order-search.provider.js';
import type { FakePriceProvider } from '../providers/price.provider.js';
import type { FakeProductAssociationsProvider } from '../providers/product-associations.provider.js';
import type { FakeProductProvider } from '../providers/product.provider.js';
import type { FakeProductReviewsProvider } from '../providers/product-reviews.provider.js';
import type { FakeSearchProvider } from '../providers/product-search.provider.js';
import type { FakeProfileProvider } from '../providers/profile.provider.js';
import type { FakeStoreProvider } from '../providers/store.provider.js';

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

type ExtractCapabilityProvider<TCapability, TDefaultProvider> =
  TCapability extends { enabled: true; provider?: infer TProviderFactory }
    ? TProviderFactory extends (...args: unknown[]) => infer TProvider
      ? TProvider
      : TDefaultProvider
    : TDefaultProvider;

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

type DefaultProviderMap<T extends FakeCapabilities> = {
  product: FakeProductProvider<ResolvedFactoryMap<T>['product']>;
  productSearch: FakeSearchProvider<ResolvedFactoryMap<T>['productSearch']>;
  identity: FakeIdentityProvider<ResolvedFactoryMap<T>['identity']>;
  category: FakeCategoryProvider<ResolvedFactoryMap<T>['category']>;
  cart: FakeCartProvider<ResolvedFactoryMap<T>['cart']>;
  inventory: FakeInventoryProvider<ResolvedFactoryMap<T>['inventory']>;
  store: FakeStoreProvider<ResolvedFactoryMap<T>['store']>;
  price: FakePriceProvider<ResolvedFactoryMap<T>['price']>;
  checkout: FakeCheckoutProvider<ResolvedFactoryMap<T>['checkout']>;
  order: FakeOrderProvider<ResolvedFactoryMap<T>['order']>;
  orderSearch: FakeOrderSearchProvider<ResolvedFactoryMap<T>['orderSearch']>;
  profile: FakeProfileProvider<ResolvedFactoryMap<T>['profile']>;
  productReviews: FakeProductReviewsProvider<ResolvedFactoryMap<T>['productReviews']>;
  productAssociations: FakeProductAssociationsProvider<
    ResolvedFactoryMap<T>['productAssociations']
  >;
};

type CapabilityProviderTypeMap<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey]: ExtractCapabilityProvider<T[K], DefaultProviderMap<T>[K]>;
};

type EnabledCapabilityOverrideMap<T extends FakeCapabilities> = {
  [K in FakeCapabilityKey as T[K] extends { enabled: true } ? K : never]:
    CapabilityProviderTypeMap<T>[K];
};

export type FakeClientFromCapabilities<T extends FakeCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  FakeCapabilityKey
> &
  EnabledCapabilityOverrideMap<T>;

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
