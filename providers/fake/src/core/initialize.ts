import type {
  Cache as ReactinaryCache,
  RequestContext,
  ClientFromCapabilities,
} from '@reactionary/core';
import { FakeProductProvider } from '../providers/product.provider.js';
import { FakeSearchProvider } from '../providers/product-search.provider.js';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeCapabilities } from '../schema/capabilities.schema.js';
import { FakeCategoryProvider } from '../providers/category.provider.js';
import {
  FakeCartProvider,
  FakeIdentityProvider,
  FakeInventoryProvider,
  FakePriceProvider,
  FakeStoreProvider,
} from '../providers/index.js';
import { FakeCheckoutProvider } from '../providers/checkout.provider.js';
import { FakeOrderSearchProvider } from '../providers/order-search.provider.js';
import { FakeOrderProvider } from '../providers/order.provider.js';
import { FakeProfileProvider } from '../providers/profile.provider.js';
import { FakeProductReviewsProvider } from '../providers/product-reviews.provider.js';
import { FakeProductAssociationsProvider } from '../providers/product-associations.provider.js';

export function withFakeCapabilities<T extends FakeCapabilities>(
  configuration: FakeConfiguration,
  capabilities: T
) {
  return (
    cache: ReactinaryCache,
    context: RequestContext
  ): ClientFromCapabilities<T> => {
    const client: any = {};

    if (capabilities.product) {
      client.product = new FakeProductProvider(configuration, cache, context);
    }

    if (capabilities.productSearch) {
      client.productSearch = new FakeSearchProvider(
        configuration,
        cache,
        context
      );
    }

    if (capabilities.category) {
      client.category = new FakeCategoryProvider(configuration, cache, context);
    }

    if (capabilities.cart) {
      client.cart = new FakeCartProvider(configuration, cache, context);
    }

    if (capabilities.inventory) {
      client.inventory = new FakeInventoryProvider(
        configuration,
        cache,
        context
      );
    }

    if (capabilities.store) {
      client.store = new FakeStoreProvider(configuration, cache, context);
    }

    if (capabilities.price) {
      client.price = new FakePriceProvider(configuration, cache, context);
    }

    if (capabilities.identity) {
      client.identity = new FakeIdentityProvider(configuration, cache, context);
    }

    if (capabilities.checkout) {
      client.checkout = new FakeCheckoutProvider(configuration, cache, context);
    }

    if (capabilities.orderSearch) {
      client.orderSearch = new FakeOrderSearchProvider(
        configuration,
        cache,
        context
      );
    }

    if (capabilities.order) {
      client.order = new FakeOrderProvider(configuration, cache, context);
    }

    if (capabilities.profile) {
      client.profile = new FakeProfileProvider(configuration, cache, context);
    }

    if (capabilities.productReviews) {
      client.productReviews = new FakeProductReviewsProvider(configuration, cache, context);
    }

    if (capabilities.productAssociations) {
      client.productAssociations = new FakeProductAssociationsProvider(configuration, cache, context);
    }

    return client;
  };
}
