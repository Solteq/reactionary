import { IdentityMutationSchema, IdentityQuerySchema, IdentitySchema, ProductMutationSchema, ProductQuerySchema, ProductSchema, SearchMutationSchema, SearchQuerySchema, SearchResultSchema, Cache, ProductProvider, SearchProvider, IdentityProvider } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeIdentityProvider } from "../providers/identity.provider";

type FakeClient<T extends FakeCapabilities> = Partial<{
    product: T['product'] extends true ? ProductProvider : never;
    search: T['search'] extends true ? SearchProvider : never;
    identity: T['identity'] extends true ? IdentityProvider : never;
}>;

export function withFakeCapabilities<T extends FakeCapabilities>(configuration: FakeConfiguration, capabilities: T) {
    return (cache: Cache): FakeClient<T> => {
        const client: FakeClient<T> = {};

        if (capabilities.product) {
            (client as any).product = new FakeProductProvider(configuration, ProductSchema, ProductQuerySchema, ProductMutationSchema, cache);
        }

        if (capabilities.search) {
            (client as any).search = new FakeSearchProvider(configuration, SearchResultSchema, SearchQuerySchema, SearchMutationSchema, cache);
        }

        if (capabilities.identity) {
            (client as any).identity = new FakeIdentityProvider(configuration, IdentitySchema, IdentityQuerySchema, IdentityMutationSchema, cache);
        }

        return client;
    };
}
