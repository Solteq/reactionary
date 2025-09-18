import { ProductSchema, SearchResultSchema, Cache as ReactinaryCache, ProductProvider, SearchProvider, IdentityProvider, CategorySchema, CategoryProvider, CartSchema, CartProvider } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeCategoryProvider } from "../providers/category.provider";
import { FakeCartProvider } from "../providers";

type FakeClient<T extends FakeCapabilities> = 
    (T['cart'] extends true ? { cart: CartProvider } : {}) &
    (T['product'] extends true ? { product: ProductProvider } : {}) &
    (T['search'] extends true ? { search: SearchProvider } : {}) &
    (T['identity'] extends true ? { identity: IdentityProvider } : {}) &
    (T['category'] extends true ? { category: CategoryProvider } : {});

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
