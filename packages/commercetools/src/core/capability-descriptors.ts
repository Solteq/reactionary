import {
  CartIdentifierSchema,
  CartSchema,
  CategoryPaginatedResultSchema,
  CategorySchema,
  CheckoutSchema,
  IdentitySchema,
  InventorySchema,
  OrderSearchResultSchema,
  OrderSchema,
  PaymentMethodSchema,
  ProductAssociationSchema,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListPaginatedResultsSchema,
  ProductListSchema,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  ProductSchema,
  ProductSearchResultSchema,
  ProfileSchema,
  PriceSchema,
  ShippingMethodSchema,
  StoreSchema,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import {
  type CommercetoolsCapabilities,
  type CommercetoolsCapabilitiesSchema,
} from '../schema/capabilities.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from './client.js';
import { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import { CommercetoolsCategoryFactory } from '../factories/category/category.factory.js';
import { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';
import { CommercetoolsInventoryFactory } from '../factories/inventory/inventory.factory.js';
import { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';
import { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';
import { CommercetoolsProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import { CommercetoolsProductListFactory } from '../factories/product-list/product-list.factory.js';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { CommercetoolsProfileFactory } from '../factories/profile/profile.factory.js';
import { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';
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

export const capabilityKeys = [
  'product',
  'profile',
  'productSearch',
  'productAssociations',
  'productList',
  'productReviews',
  'identity',
  'cart',
  'inventory',
  'price',
  'category',
  'checkout',
  'store',
  'order',
  'orderSearch',
] as const;

export type OverridableCapabilityKey = (typeof capabilityKeys)[number];

type ProviderArgs<TFactory> = {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: TFactory;
};

type ParsedCapabilities = z.infer<typeof CommercetoolsCapabilitiesSchema>;

export type CapabilityDescriptor = {
  isEnabled: (caps: ParsedCapabilities) => boolean | undefined;
  getOverride: (caps: CommercetoolsCapabilities) => {
    factory?: any;
    provider?: (args: any) => any;
  } | undefined;
  createDefaultFactory: () => any;
  createDefaultProvider: (args: any) => any;
};

export const capabilityDescriptors: Record<OverridableCapabilityKey, CapabilityDescriptor> = {
  product: {
    isEnabled: (caps) => caps.product?.enabled,
    getOverride: (caps) => caps.product,
    createDefaultFactory: () => new CommercetoolsProductFactory(ProductSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsProductProvider(
        args.cache,
        args.context,
        args.config,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  profile: {
    isEnabled: (caps) => caps.profile?.enabled,
    getOverride: (caps) => caps.profile,
    createDefaultFactory: () => new CommercetoolsProfileFactory(ProfileSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsProfileProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productSearch: {
    isEnabled: (caps) => caps.productSearch?.enabled,
    getOverride: (caps) => caps.productSearch,
    createDefaultFactory: () =>
      new CommercetoolsProductSearchFactory(ProductSearchResultSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsSearchProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productAssociations: {
    isEnabled: (caps) => caps.productAssociations?.enabled,
    getOverride: (caps) => caps.productAssociations,
    createDefaultFactory: () =>
      new CommercetoolsProductAssociationsFactory(ProductAssociationSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsProductAssociationsProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productList: {
    isEnabled: (caps) => caps.productList?.enabled,
    getOverride: (caps) => caps.productList,
    createDefaultFactory: () =>
      new CommercetoolsProductListFactory(
        ProductListSchema,
        ProductListItemSchema,
        ProductListPaginatedResultsSchema,
        ProductListItemPaginatedResultsSchema,
      ),
    createDefaultProvider: (args) =>
      new CommercetoolsProductListProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productReviews: {
    isEnabled: (caps) => caps.productReviews?.enabled,
    getOverride: (caps) => caps.productReviews,
    createDefaultFactory: () =>
      new CommercetoolsProductReviewsFactory(
        ProductRatingSummarySchema,
        ProductReviewSchema,
        ProductReviewPaginatedResultSchema,
      ),
    createDefaultProvider: (args) =>
      new CommercetoolsProductReviewsProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  identity: {
    isEnabled: (caps) => caps.identity?.enabled,
    getOverride: (caps) => caps.identity,
    createDefaultFactory: () => new CommercetoolsIdentityFactory(IdentitySchema),
    createDefaultProvider: (args) =>
      new CommercetoolsIdentityProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  cart: {
    isEnabled: (caps) => caps.cart?.enabled,
    getOverride: (caps) => caps.cart,
    createDefaultFactory: () =>
      new CommercetoolsCartFactory(CartSchema, CartIdentifierSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsCartProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  inventory: {
    isEnabled: (caps) => caps.inventory?.enabled,
    getOverride: (caps) => caps.inventory,
    createDefaultFactory: () => new CommercetoolsInventoryFactory(InventorySchema),
    createDefaultProvider: (args) =>
      new CommercetoolsInventoryProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  price: {
    isEnabled: (caps) => caps.price?.enabled,
    getOverride: (caps) => caps.price,
    createDefaultFactory: () => new CommercetoolsPriceFactory(PriceSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsPriceProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  category: {
    isEnabled: (caps) => caps.category?.enabled,
    getOverride: (caps) => caps.category,
    createDefaultFactory: () =>
      new CommercetoolsCategoryFactory(CategorySchema, CategoryPaginatedResultSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsCategoryProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  checkout: {
    isEnabled: (caps) => caps.checkout?.enabled,
    getOverride: (caps) => caps.checkout,
    createDefaultFactory: () =>
      new CommercetoolsCheckoutFactory(
        CheckoutSchema,
        ShippingMethodSchema,
        PaymentMethodSchema,
      ),
    createDefaultProvider: (args) =>
      new CommercetoolsCheckoutProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  store: {
    isEnabled: (caps) => caps.store?.enabled,
    getOverride: (caps) => caps.store,
    createDefaultFactory: () => new CommercetoolsStoreFactory(StoreSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsStoreProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  order: {
    isEnabled: (caps) => caps.order?.enabled,
    getOverride: (caps) => caps.order,
    createDefaultFactory: () => new CommercetoolsOrderFactory(OrderSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsOrderProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  orderSearch: {
    isEnabled: (caps) => caps.orderSearch?.enabled,
    getOverride: (caps) => caps.orderSearch,
    createDefaultFactory: () =>
      new CommercetoolsOrderSearchFactory(OrderSearchResultSchema),
    createDefaultProvider: (args) =>
      new CommercetoolsOrderSearchProvider(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
};
