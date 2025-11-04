import type {
  Cache as ReactinaryCache,
  ProductProvider,
  ProductSearchProvider,
  IdentityProvider,
  CategoryProvider,
  CartProvider,
  InventoryProvider,
  StoreProvider,
  PriceProvider,
} from '@reactionary/core';
import {
  ProductSchema,
  ProductSearchResultSchema,
  CategorySchema,
  CartSchema,
  InventorySchema,
  StoreSchema,
  PriceSchema,
  ProductSearchResultItemSchema,
} from '@reactionary/core';
import { FakeProductProvider } from '../providers/product.provider.js';
import { FakeSearchProvider } from '../providers/product-search.provider.js';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeCapabilities } from '../schema/capabilities.schema.js';
import { FakeCategoryProvider } from '../providers/category.provider.js';
import {
  FakeCartProvider,
  FakeInventoryProvider,
  FakePriceProvider,
  FakeStoreProvider,
} from '../providers/index.js';

type FakeClient<T extends FakeCapabilities> = (T['cart'] extends true
  ? { cart: CartProvider }
  : object) &
  (T['product'] extends true ? { product: ProductProvider } : object) &
  (T['productSearch'] extends true ? { productSearch: ProductSearchProvider } : object) &
  (T['identity'] extends true ? { identity: IdentityProvider } : object) &
  (T['category'] extends true ? { category: CategoryProvider } : object) &
  (T['inventory'] extends true ? { inventory: InventoryProvider } : object) &
  (T['store'] extends true ? { store: StoreProvider } : object) &
  (T['price'] extends true ? { price: PriceProvider } : object);

export function withFakeCapabilities<T extends FakeCapabilities>(
  configuration: FakeConfiguration,
  capabilities: T
) {
  return (cache: ReactinaryCache): FakeClient<T> => {
    const client: any = {};

    if (capabilities.product) {
      client.product = new FakeProductProvider(
        configuration,
        ProductSchema,
        cache
      );
    }

    if (capabilities.productSearch) {
      client.productSearch = new FakeSearchProvider(
        configuration,
        ProductSearchResultItemSchema,
        cache
      );
    }

    if (capabilities.category) {
      client.category = new FakeCategoryProvider(
        configuration,
        CategorySchema,
        cache
      );
    }

    if (capabilities.cart) {
      client.cart = new FakeCartProvider(configuration, CartSchema, cache);
    }

    if (capabilities.inventory) {
      client.inventory = new FakeInventoryProvider(
        configuration,
        InventorySchema,
        cache
      );
    }

    if (capabilities.store) {
      client.store = new FakeStoreProvider(configuration, StoreSchema, cache);
    }

    if (capabilities.price) {
      client.price = new FakePriceProvider(configuration, PriceSchema, cache);
    }

    return client;
  };
}
