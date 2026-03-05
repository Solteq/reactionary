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
  ProductRecommendationsProvider,
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
import type { MedusaCartProvider } from '../providers/cart.provider.js';
import type { MedusaCategoryProvider } from '../providers/category.provider.js';
import type { MedusaCheckoutProvider } from '../providers/checkout.provider.js';
import type { MedusaInventoryProvider } from '../providers/inventory.provider.js';
import type { MedusaOrderProvider } from '../providers/order.provider.js';
import type { MedusaOrderSearchProvider } from '../providers/order-search.provider.js';
import type { MedusaPriceProvider } from '../providers/price.provider.js';
import type { MedusaProductAssociationsProvider } from '../providers/product-associations.provider.js';
import type { MedusaProductProvider } from '../providers/product.provider.js';
import type { MedusaSearchProvider } from '../providers/product-search.provider.js';
import type { MedusaProfileProvider } from '../providers/profile.provider.js';
import type { MedusaProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import type { MedusaIdentityProvider } from '../providers/identity.provider.js';

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

type ExtractCapabilityProvider<TCapability, TDefaultProvider> =
  TCapability extends { enabled: true; provider?: infer TProviderFactory }
    ? TProviderFactory extends (...args: unknown[]) => infer TProvider
      ? TProvider
      : TDefaultProvider
    : TDefaultProvider;

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

type DefaultProviderMap<T extends MedusaCapabilities> = {
  product: MedusaProductProvider<ResolvedFactoryMap<T>['product']>;
  productSearch: MedusaSearchProvider<ResolvedFactoryMap<T>['productSearch']>;
  cart: MedusaCartProvider<ResolvedFactoryMap<T>['cart']>;
  checkout: MedusaCheckoutProvider<ResolvedFactoryMap<T>['checkout']>;
  category: MedusaCategoryProvider<ResolvedFactoryMap<T>['category']>;
  price: MedusaPriceProvider<ResolvedFactoryMap<T>['price']>;
  order: MedusaOrderProvider<ResolvedFactoryMap<T>['order']>;
  orderSearch: MedusaOrderSearchProvider<ResolvedFactoryMap<T>['orderSearch']>;
  inventory: MedusaInventoryProvider<ResolvedFactoryMap<T>['inventory']>;
  profile: MedusaProfileProvider<ResolvedFactoryMap<T>['profile']>;
  productAssociations: MedusaProductAssociationsProvider<
    ResolvedFactoryMap<T>['productAssociations']
  >;
  identity: MedusaIdentityProvider;
  productRecommendations: MedusaProductRecommendationsProvider;
};

type CapabilityProviderTypeMap<T extends MedusaCapabilities> = {
  [K in OverridableCapabilityKey | 'productRecommendations' | 'identity']: ExtractCapabilityProvider<
    T[K],
    DefaultProviderMap<T>[K]
  >;
};

type EnabledCapabilityOverrideMap<T extends MedusaCapabilities> = {
  [K in OverridableCapabilityKey | 'productRecommendations' | 'identity' as T[K] extends {
    enabled: true;
  }
    ? K
    : never]: CapabilityProviderTypeMap<T>[K];
};

export type MedusaClientFromCapabilities<T extends MedusaCapabilities> = Omit<
  ClientFromCapabilities<NormalizeConfiguredCapabilities<T>>,
  OverridableCapabilityKey | 'productRecommendations' | 'identity'
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

export function resolveProviderOnlyCapability<TProvider, TProviderArgs>(
  capability:
    | {
        provider?: (args: TProviderArgs) => TProvider;
      }
    | undefined,
  defaultProvider: (args: TProviderArgs) => TProvider,
  args: TProviderArgs,
): TProvider {
  const provider = capability?.provider ?? defaultProvider;
  return provider(args);
}
