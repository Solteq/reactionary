import { ProductSchema, SearchResultSchema, Cache as ReactinaryCache, ProductProvider, SearchProvider, IdentityProvider, CategorySchema, CategoryProvider } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeCategoryProvider } from "../providers/category.provider";

type FakeClient<T extends FakeCapabilities> = Partial<{
    product: T['product'] extends true ? ProductProvider : never;
    search: T['search'] extends true ? SearchProvider : never;
    identity: T['identity'] extends true ? IdentityProvider : never;
    category: T['category'] extends true ? CategoryProvider : never;
}>;

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

        return client;
    };
}
