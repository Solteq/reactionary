import { Client, ProductSchema, SearchResultSchema } from "@reactionary/core";
import { FakeConfig } from "./configuration";
import { FakeCapabilities } from "./capabilities";
import { FakeProductProvider } from "../providers/product.provider";
import { FakeSearchProvider } from "../providers/search.provider";

export function withFakeCapabilities(configuration: FakeConfig, capabilities: FakeCapabilities) {
    const client = {} as Client;

    if (capabilities.product) {
        client.product = new FakeProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new FakeSearchProvider(configuration, SearchResultSchema);
    }

    return client;
}
