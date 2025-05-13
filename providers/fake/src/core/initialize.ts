import { Client, ProductSchema, SearchResultSchema } from "@reactionary/core";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";
import { FakeConfiguration } from "../schema/configuration.schema";
import { FakeCapabilities } from "../schema/capabilities.schema";

export function withFakeCapabilities(configuration: FakeConfiguration, capabilities: FakeCapabilities) {
    const client = {} as Partial<Client>;

    if (capabilities.product) {
        client.product = new FakeProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new FakeSearchProvider(configuration, SearchResultSchema);
    }

    return client;
}
