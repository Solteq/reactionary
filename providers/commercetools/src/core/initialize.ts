import type { Cache, RequestContext } from '@reactionary/core';
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
import { ProductFactory } from '../factories/product.factory.js';

type CommercetoolsProviders<
  PF extends ProductFactory
> = {
  product: CommercetoolsProductProvider<PF>;
  profile: CommercetoolsProfileProvider;
  productSearch: CommercetoolsSearchProvider;
  productAssociations: CommercetoolsProductAssociationsProvider;
  productList: CommercetoolsProductListProvider;
  productReviews: CommercetoolsProductReviewsProvider;
  identity: CommercetoolsIdentityProvider;
  cart: CommercetoolsCartProvider;
  inventory: CommercetoolsInventoryProvider;
  price: CommercetoolsPriceProvider;
  category: CommercetoolsCategoryProvider;
  checkout: CommercetoolsCheckoutProvider;
  store: CommercetoolsStoreProvider;
  order: CommercetoolsOrderProvider;
  orderSearch: CommercetoolsOrderSearchProvider;
};

type EnabledCommercetoolsProviders<
  T extends CommercetoolsCapabilities,
  PF extends ProductFactory
> = {
  [K in keyof CommercetoolsProviders<PF> as K extends keyof T
    ? T[K] extends true
      ? K
      : never
    : never]: CommercetoolsProviders<PF>[K];
};

export function withCommercetoolsCapabilities<
  T extends CommercetoolsCapabilities,
  PF extends ProductFactory = ProductFactory
>(
  configuration: CommercetoolsConfiguration,
  capabilities: T,
  options?: { productFactory?: PF }
) {
  return (
    cache: Cache,
    context: RequestContext
  ): EnabledCommercetoolsProviders<T, PF> => {
    const client: Partial<CommercetoolsProviders<PF>> = {};
    const config = CommercetoolsConfigurationSchema.parse(configuration);
    const caps = CommercetoolsCapabilitiesSchema.parse(capabilities);
    const commercetoolsApi = new CommercetoolsAPI(config, context);

    if (caps.product) {
      const productFactory = (options?.productFactory ?? new ProductFactory()) as PF;
      client.product = new CommercetoolsProductProvider(
        config,
        cache,
        context,
        commercetoolsApi,
        productFactory
      );
    }

    if (caps.profile) {
      client.profile = new CommercetoolsProfileProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.productSearch) {
      client.productSearch = new CommercetoolsSearchProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.productAssociations) {
      client.productAssociations = new CommercetoolsProductAssociationsProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.productList) {
      client.productList = new CommercetoolsProductListProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.productReviews) {
      client.productReviews = new CommercetoolsProductReviewsProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.identity) {
      client.identity = new CommercetoolsIdentityProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.cart) {
      client.cart = new CommercetoolsCartProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.inventory) {
      client.inventory = new CommercetoolsInventoryProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.price) {
      client.price = new CommercetoolsPriceProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.category) {
      client.category = new CommercetoolsCategoryProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.checkout) {
      client.checkout = new CommercetoolsCheckoutProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.store) {
        client.store = new CommercetoolsStoreProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    if (caps.order) {
        client.order = new CommercetoolsOrderProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }
    if (caps.orderSearch) {
        client.orderSearch = new CommercetoolsOrderSearchProvider(
        config,
        cache,
        context,
        commercetoolsApi
      );
    }

    return client as EnabledCommercetoolsProviders<T, PF>;
  };
}
