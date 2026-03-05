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
import type { CommercetoolsCartProvider } from '../providers/cart.provider.js';
import type { CommercetoolsCategoryProvider } from '../providers/category.provider.js';
import type { CommercetoolsCheckoutProvider } from '../providers/checkout.provider.js';
import type { CommercetoolsIdentityProvider } from '../providers/identity.provider.js';
import type { CommercetoolsInventoryProvider } from '../providers/inventory.provider.js';
import type { CommercetoolsOrderSearchProvider } from '../providers/order-search.provider.js';
import type { CommercetoolsOrderProvider } from '../providers/order.provider.js';
import type { CommercetoolsPriceProvider } from '../providers/price.provider.js';
import type { CommercetoolsProductAssociationsProvider } from '../providers/product-associations.provider.js';
import type { CommercetoolsProductListProvider } from '../providers/product-list.provider.js';
import type { CommercetoolsProductProvider } from '../providers/product.provider.js';
import type { CommercetoolsProductReviewsProvider } from '../providers/product-reviews.provider.js';
import type { CommercetoolsSearchProvider } from '../providers/product-search.provider.js';
import type { CommercetoolsProfileProvider } from '../providers/profile.provider.js';
import type { CommercetoolsStoreProvider } from '../providers/store.provider.js';

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

type ExtractCapabilityProvider<TCapability, TDefaultProvider> =
  TCapability extends { enabled: true; provider?: infer TProviderFactory }
    ? TProviderFactory extends (...args: any[]) => infer TProvider
      ? TProvider
      : TDefaultProvider
    : TDefaultProvider;

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

type DefaultProviderMap<T extends CommercetoolsCapabilities> = {
  product: CommercetoolsProductProvider<ResolvedFactoryMap<T>['product']>;
  productSearch: CommercetoolsSearchProvider<ResolvedFactoryMap<T>['productSearch']>;
  productAssociations: CommercetoolsProductAssociationsProvider<
    ResolvedFactoryMap<T>['productAssociations']
  >;
  productReviews: CommercetoolsProductReviewsProvider<
    ResolvedFactoryMap<T>['productReviews']
  >;
  productList: CommercetoolsProductListProvider<ResolvedFactoryMap<T>['productList']>;
  identity: CommercetoolsIdentityProvider<ResolvedFactoryMap<T>['identity']>;
  cart: CommercetoolsCartProvider<ResolvedFactoryMap<T>['cart']>;
  checkout: CommercetoolsCheckoutProvider<ResolvedFactoryMap<T>['checkout']>;
  order: CommercetoolsOrderProvider<ResolvedFactoryMap<T>['order']>;
  orderSearch: CommercetoolsOrderSearchProvider<ResolvedFactoryMap<T>['orderSearch']>;
  inventory: CommercetoolsInventoryProvider<ResolvedFactoryMap<T>['inventory']>;
  price: CommercetoolsPriceProvider<ResolvedFactoryMap<T>['price']>;
  category: CommercetoolsCategoryProvider<ResolvedFactoryMap<T>['category']>;
  store: CommercetoolsStoreProvider<ResolvedFactoryMap<T>['store']>;
  profile: CommercetoolsProfileProvider<ResolvedFactoryMap<T>['profile']>;
};

type CapabilityProviderTypeMap<T extends CommercetoolsCapabilities> = {
  [K in OverridableCapabilityKey]: ExtractCapabilityProvider<T[K], DefaultProviderMap<T>[K]>;
};

type EnabledCapabilityOverrideMap<T extends CommercetoolsCapabilities> = {
  [K in OverridableCapabilityKey as T[K] extends { enabled: true } ? K : never]:
    CapabilityProviderTypeMap<T>[K];
};

export type CommercetoolsClientFromCapabilities<
  T extends CommercetoolsCapabilities,
> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey
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
