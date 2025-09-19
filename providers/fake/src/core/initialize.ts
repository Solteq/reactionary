import type { Cache as ReactinaryCache, ProductProvider, SearchProvider, IdentityProvider, CategoryProvider, CartProvider } from "@reactionary/core";
import { ProductSchema, SearchResultSchema, CategorySchema, CartSchema } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import type { FakeConfiguration } from "../schema/configuration.schema";
import type { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeCategoryProvider } from "../providers/category.provider";
import { FakeCartProvider } from "../providers";

type FakeClient<T extends FakeCapabilities> = 
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) &
    (T['search'] extends true ? { search: SearchProvider } : object) &
    (T['identity'] extends true ? { identity: IdentityProvider } : object) &
    (T['category'] extends true ? { category: CategoryProvider } : object);

export function withFakeCapabilities<T extends FakeCapabilities>(configuration: FakeConfiguration, capabilities: T) {
    return (cache: ReactinaryCache): FakeClient<T> => {
        const client: any = {};

        if (capabilities.product) {
            client.product = new FakeProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.search) {
            client.search = new FakeSearchProvider(configuration, SearchResultSchema, cache);
        }

        if (capabilities.category) {
          client.category = new FakeCategoryProvider(configuration, CategorySchema, cache);
        }

        if (capabilities.cart) {
          client.cart = new FakeCartProvider(configuration, CartSchema, cache);
        }


        return client;
    };
}
