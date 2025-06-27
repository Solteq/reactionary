import { Client, IdentityMutationSchema, IdentityQuerySchema, IdentitySchema, ProductMutationSchema, ProductQuerySchema, ProductSchema, SearchMutationSchema, SearchQuerySchema, SearchResultSchema } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";
import { FakeIdentityProvider } from "../providers/identity.provider";

export function withFakeCapabilities(configuration: FakeConfiguration, capabilities: FakeCapabilities) {
    const client = {} as Partial<Client>;

    if (capabilities.product) {
        client.product = new FakeProductProvider(configuration, ProductSchema, ProductQuerySchema, ProductMutationSchema);
    }

    if (capabilities.search) {
        client.search = new FakeSearchProvider(configuration, SearchResultSchema, SearchQuerySchema, SearchMutationSchema);
    }

    if (capabilities.identity) {
        client.identity = new FakeIdentityProvider(configuration, IdentitySchema, IdentityQuerySchema, IdentityMutationSchema);
    }

    return client;
}
