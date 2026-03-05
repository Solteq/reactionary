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
  ProfileSchema,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  PriceSchema,
  ProductSchema,
  ProductSearchResultSchema,
  ShippingMethodSchema,
  StoreSchema,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import {
  CommercetoolsCapabilitiesSchema,
  type CommercetoolsCapabilities,
} from '../schema/capabilities.schema.js';
import { CommercetoolsSearchProvider } from '../providers/product-search.provider.js';
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import {
  CommercetoolsConfigurationSchema,
  type CommercetoolsConfiguration,
} from '../schema/configuration.schema.js';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider.js';
import { CommercetoolsCartProvider } from '../providers/cart.provider.js';
import { CommercetoolsInventoryProvider } from '../providers/inventory.provider.js';
import { CommercetoolsPriceProvider } from '../providers/price.provider.js';
import { CommercetoolsCategoryProvider } from '../providers/category.provider.js';
import {
  CommercetoolsCheckoutProvider,
  CommercetoolsOrderProvider,
  CommercetoolsOrderSearchProvider,
  CommercetoolsProfileProvider,
  CommercetoolsStoreProvider,
  CommercetoolsProductReviewsProvider,
  CommercetoolsProductAssociationsProvider,
  CommercetoolsProductListProvider,
} from '../providers/index.js';
import { CommercetoolsAPI } from './client.js';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { CommercetoolsInventoryFactory } from '../factories/inventory/inventory.factory.js';
import { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';
import { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';
import { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';
import { CommercetoolsCategoryFactory } from '../factories/category/category.factory.js';
import { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import { CommercetoolsProfileFactory } from '../factories/profile/profile.factory.js';
import { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { CommercetoolsProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import { CommercetoolsProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import { CommercetoolsProductListFactory } from '../factories/product-list/product-list.factory.js';
import { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';
import {
  type CheckoutProviderFactory,
  type CheckoutProviderFactoryArgs,
  type CommercetoolsClientFromCapabilities,
  type ProductProviderFactory,
  type ProductProviderFactoryArgs,
  resolveCapabilityProvider,
} from './initialize.types.js';

export function withCommercetoolsCapabilities<
  T extends CommercetoolsCapabilities,
>(configuration: CommercetoolsConfiguration, capabilities: T) {
  return (
    cache: Cache,
    context: RequestContext,
  ): CommercetoolsClientFromCapabilities<T> => {
    const client: any = {};
    const config = CommercetoolsConfigurationSchema.parse(configuration);
    const caps = CommercetoolsCapabilitiesSchema.parse(capabilities);
    const commercetoolsApi = new CommercetoolsAPI(config, context);

    if (caps.product?.enabled) {
      const capsProduct = capabilities.product;
      const defaultFactory = new CommercetoolsProductFactory(ProductSchema);
      const defaultProvider: ProductProviderFactory = (args) =>
        new CommercetoolsProductProvider(
          args.cache,
          args.context,
          args.config,
          args.commercetoolsApi,
          args.factory,
        );

      client.product = resolveCapabilityProvider(
        capsProduct,
        {
          factory: defaultFactory,
          provider: defaultProvider,
        },
        (factory): ProductProviderFactoryArgs => ({
          cache,
          context,
          config,
          commercetoolsApi,
          factory,
        }),
      );
    }

    if (caps.profile) {
      const profileFactory = new CommercetoolsProfileFactory(ProfileSchema);
      client.profile = new CommercetoolsProfileProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        profileFactory,
      );
    }

    if (caps.productSearch) {
      const productSearchFactory = new CommercetoolsProductSearchFactory(
        ProductSearchResultSchema,
      );
      client.productSearch = new CommercetoolsSearchProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        productSearchFactory,
      );
    }

    if (caps.productAssociations) {
      const productAssociationsFactory =
        new CommercetoolsProductAssociationsFactory(ProductAssociationSchema);
      client.productAssociations = new CommercetoolsProductAssociationsProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        productAssociationsFactory,
      );
    }

    if (caps.productList) {
      const productListFactory = new CommercetoolsProductListFactory(
        ProductListSchema,
        ProductListItemSchema,
        ProductListPaginatedResultsSchema,
        ProductListItemPaginatedResultsSchema,
      );
      client.productList = new CommercetoolsProductListProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        productListFactory,
      );
    }

    if (caps.productReviews) {
      const productReviewsFactory = new CommercetoolsProductReviewsFactory(
        ProductRatingSummarySchema,
        ProductReviewSchema,
        ProductReviewPaginatedResultSchema,
      );
      client.productReviews = new CommercetoolsProductReviewsProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        productReviewsFactory,
      );
    }

    if (caps.identity) {
      const identityFactory = new CommercetoolsIdentityFactory(IdentitySchema);
      client.identity = new CommercetoolsIdentityProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        identityFactory,
      );
    }

    if (caps.cart) {
      const cartFactory = new CommercetoolsCartFactory(
        CartSchema,
        CartIdentifierSchema,
      );
      client.cart = new CommercetoolsCartProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        cartFactory,
      );
    }

    if (caps.inventory) {
      const inventoryFactory = new CommercetoolsInventoryFactory(
        InventorySchema,
      );
      client.inventory = new CommercetoolsInventoryProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        inventoryFactory,
      );
    }

    if (caps.price) {
      const priceFactory = new CommercetoolsPriceFactory(PriceSchema);
      client.price = new CommercetoolsPriceProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        priceFactory,
      );
    }

    if (caps.category) {
      const categoryFactory = new CommercetoolsCategoryFactory(
        CategorySchema,
        CategoryPaginatedResultSchema,
      );
      client.category = new CommercetoolsCategoryProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        categoryFactory,
      );
    }

    if (caps.checkout?.enabled) {
      const capsCheckout = capabilities.checkout;
      const defaultFactory = new CommercetoolsCheckoutFactory(
        CheckoutSchema,
        ShippingMethodSchema,
        PaymentMethodSchema,
      );
      const defaultProvider: CheckoutProviderFactory = (args) =>
        new CommercetoolsCheckoutProvider(
          args.config,
          args.cache,
          args.context,
          args.commercetoolsApi,
          args.factory,
        );

      client.checkout = resolveCapabilityProvider(
        capsCheckout,
        {
          factory: defaultFactory,
          provider: defaultProvider,
        },
        (factory): CheckoutProviderFactoryArgs => ({
          cache,
          context,
          config,
          commercetoolsApi,
          factory,
        }),
      );
    }

    if (caps.store) {
      const storeFactory = new CommercetoolsStoreFactory(StoreSchema);
      client.store = new CommercetoolsStoreProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        storeFactory,
      );
    }

    if (caps.order) {
      const orderFactory = new CommercetoolsOrderFactory(OrderSchema);
      client.store = new CommercetoolsOrderProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        orderFactory,
      );
    }
    if (caps.orderSearch) {
      const orderSearchFactory = new CommercetoolsOrderSearchFactory(
        OrderSearchResultSchema,
      );
      client.orderSearch = new CommercetoolsOrderSearchProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        orderSearchFactory,
      );
    }

    return client;
  };
}
