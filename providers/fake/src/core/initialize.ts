import { Client, IdentityMutationSchema, IdentityQuerySchema, IdentitySchema, ProductMutationSchema, ProductQuerySchema, ProductSchema, SearchMutationSchema, SearchQuerySchema, SearchResultSchema, RedisCache } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeIdentityProvider } from "../providers/identity.provider";

export function withFakeCapabilities(configuration: FakeConfiguration, capabilities: FakeCapabilities) {
    return (cache: RedisCache) => {
        const client = {} as Partial<Client>;

        if (capabilities.product) {
            client.product = new FakeProductProvider(configuration, ProductSchema, ProductQuerySchema, ProductMutationSchema, cache);
        }

        if (capabilities.search) {
            client.search = new FakeSearchProvider(configuration, SearchResultSchema, SearchQuerySchema, SearchMutationSchema, cache);
        }

        if (capabilities.identity) {
            client.identity = new FakeIdentityProvider(configuration, IdentitySchema, IdentityQuerySchema, IdentityMutationSchema, cache);
        }

        return client;
    };
}
