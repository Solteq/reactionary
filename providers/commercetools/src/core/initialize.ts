import type { Cache, RequestContext, Client, ClientFromCapabilities } from '@reactionary/core';
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
} from '../providers/index.js';
import { CommercetoolsAPI } from './client.js';

export function withCommercetoolsCapabilities<
  T extends CommercetoolsCapabilities
>(configuration: CommercetoolsConfiguration, capabilities: T) {
  return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
    const client: any = {};
    const config = CommercetoolsConfigurationSchema.parse(configuration);
    const caps = CommercetoolsCapabilitiesSchema.parse(capabilities);
    const commercetoolsApi = new CommercetoolsAPI(config, context);

    if (caps.product) {
      client.product = new CommercetoolsProductProvider(
        config,
        cache,
        context,
        commercetoolsApi
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
        client.store = new CommercetoolsOrderProvider(
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

    return client;
  };
}
