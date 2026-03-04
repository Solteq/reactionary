import {
  ProductSchema,
  type Product,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { ProductFactory } from '../factories/product.factory.js';
import { CommercetoolsCartProvider } from '../providers/cart.provider.js';
import { CommercetoolsCategoryProvider } from '../providers/category.provider.js';
import { CommercetoolsCheckoutProvider } from '../providers/checkout.provider.js';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider.js';
import { CommercetoolsInventoryProvider } from '../providers/inventory.provider.js';
import { CommercetoolsOrderProvider } from '../providers/order.provider.js';
import { CommercetoolsOrderSearchProvider } from '../providers/order-search.provider.js';
import { CommercetoolsPriceProvider } from '../providers/price.provider.js';
import { CommercetoolsProductAssociationsProvider } from '../providers/product-associations.provider.js';
import { CommercetoolsProductListProvider } from '../providers/product-list.provider.js';
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import { CommercetoolsProductReviewsProvider } from '../providers/product-reviews.provider.js';
import { CommercetoolsSearchProvider } from '../providers/product-search.provider.js';
import { CommercetoolsProfileProvider } from '../providers/profile.provider.js';
import { CommercetoolsStoreProvider } from '../providers/store.provider.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from './client.js';

export type ProductFactoryContract<TProduct extends Product = Product> = {
  parseProduct(data: unknown): TProduct;
};

type NoopFactory = Record<string, never>;

type ProviderCreationContext = {
  config: CommercetoolsConfiguration;
  cache: Cache;
  context: RequestContext;
  commercetoolsApi: CommercetoolsAPI;
};

function createProductProvider<TProduct extends Product>(
  deps: ProviderCreationContext,
  factory: ProductFactoryContract<TProduct>
) {
  return new CommercetoolsProductProvider<TProduct>(
    deps.config,
    deps.cache,
    deps.context,
    deps.commercetoolsApi,
    factory
  );
}

const capabilityDescriptors = {
  product: {
    defaultFactory: (): ProductFactoryContract<Product> =>
      new ProductFactory(ProductSchema),
    createProvider: createProductProvider,
  },
  profile: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsProfileProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  productSearch: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsSearchProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  productAssociations: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsProductAssociationsProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  productList: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsProductListProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  productReviews: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsProductReviewsProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  identity: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsIdentityProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  cart: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsCartProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  inventory: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsInventoryProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  price: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsPriceProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  category: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsCategoryProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  checkout: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsCheckoutProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  store: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsStoreProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  order: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsOrderProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
  orderSearch: {
    defaultFactory: (): NoopFactory => ({}),
    createProvider: (deps: ProviderCreationContext, _factory: NoopFactory) =>
      new CommercetoolsOrderSearchProvider(
        deps.config,
        deps.cache,
        deps.context,
        deps.commercetoolsApi
      ),
  },
} as const;

type CapabilityDescriptors = typeof capabilityDescriptors;
type CapabilityKey = keyof CapabilityDescriptors;

export type FactoryContracts = {
  [K in CapabilityKey]: ReturnType<CapabilityDescriptors[K]['defaultFactory']>;
};

export type FactoryOverrides = Partial<FactoryContracts>;

type SelectedFactory<
  F extends FactoryOverrides,
  K extends keyof FactoryContracts
> = K extends keyof F ? Exclude<F[K], undefined> : FactoryContracts[K];

type OutputOfFactory<TFactory, TFallback> =
  TFactory extends { parseProduct(data: unknown): infer TOutput }
    ? TOutput
    : TFallback;

type ProductOutput<F extends FactoryOverrides> = OutputOfFactory<
  SelectedFactory<F, 'product'>,
  Product
>;

type ProviderForCapability<
  K extends CapabilityKey,
  F extends FactoryOverrides
> = K extends 'product'
  ? CommercetoolsProductProvider<ProductOutput<F>>
  : ReturnType<CapabilityDescriptors[K]['createProvider']>;

export type CommercetoolsProviders<F extends FactoryOverrides> = {
  [K in CapabilityKey]: ProviderForCapability<K, F>;
};

export type ProviderFactoryMap<P extends Record<string, unknown>> = {
  [K in keyof P]: () => P[K];
};

type ResolvedFactories<F extends FactoryOverrides> = {
  product: ProductFactoryContract<ProductOutput<F>>;
  profile: SelectedFactory<F, 'profile'>;
  productSearch: SelectedFactory<F, 'productSearch'>;
  productAssociations: SelectedFactory<F, 'productAssociations'>;
  productList: SelectedFactory<F, 'productList'>;
  productReviews: SelectedFactory<F, 'productReviews'>;
  identity: SelectedFactory<F, 'identity'>;
  cart: SelectedFactory<F, 'cart'>;
  inventory: SelectedFactory<F, 'inventory'>;
  price: SelectedFactory<F, 'price'>;
  category: SelectedFactory<F, 'category'>;
  checkout: SelectedFactory<F, 'checkout'>;
  store: SelectedFactory<F, 'store'>;
  order: SelectedFactory<F, 'order'>;
  orderSearch: SelectedFactory<F, 'orderSearch'>;
};

export function resolveFactories<F extends FactoryOverrides>(
  overrides?: F
): ResolvedFactories<F> {
  const defaults = Object.fromEntries(
    (Object.keys(capabilityDescriptors) as CapabilityKey[]).map((key) => [
      key,
      capabilityDescriptors[key].defaultFactory(),
    ])
  ) as FactoryContracts;

  return { ...defaults, ...overrides } as ResolvedFactories<F>;
}

export function createProviderFactories<F extends FactoryOverrides>(
  config: CommercetoolsConfiguration,
  cache: Cache,
  context: RequestContext,
  commercetoolsApi: CommercetoolsAPI,
  factories: ResolvedFactories<F>
): ProviderFactoryMap<CommercetoolsProviders<F>> {
  const deps: ProviderCreationContext = {
    config,
    cache,
    context,
    commercetoolsApi,
  };

  return {
    product: () => capabilityDescriptors.product.createProvider(deps, factories.product),
    profile: () => capabilityDescriptors.profile.createProvider(deps, factories.profile),
    productSearch: () =>
      capabilityDescriptors.productSearch.createProvider(deps, factories.productSearch),
    productAssociations: () =>
      capabilityDescriptors.productAssociations.createProvider(
        deps,
        factories.productAssociations
      ),
    productList: () =>
      capabilityDescriptors.productList.createProvider(deps, factories.productList),
    productReviews: () =>
      capabilityDescriptors.productReviews.createProvider(deps, factories.productReviews),
    identity: () => capabilityDescriptors.identity.createProvider(deps, factories.identity),
    cart: () => capabilityDescriptors.cart.createProvider(deps, factories.cart),
    inventory: () =>
      capabilityDescriptors.inventory.createProvider(deps, factories.inventory),
    price: () => capabilityDescriptors.price.createProvider(deps, factories.price),
    category: () => capabilityDescriptors.category.createProvider(deps, factories.category),
    checkout: () => capabilityDescriptors.checkout.createProvider(deps, factories.checkout),
    store: () => capabilityDescriptors.store.createProvider(deps, factories.store),
    order: () => capabilityDescriptors.order.createProvider(deps, factories.order),
    orderSearch: () =>
      capabilityDescriptors.orderSearch.createProvider(deps, factories.orderSearch),
  } satisfies ProviderFactoryMap<CommercetoolsProviders<F>>;
}
