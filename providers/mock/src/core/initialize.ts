import { Client, ProductSchema } from "@reactionary/core";
import { MockConfig } from "./configuration";
import { MockCapabilities } from "./capabilities";
import { MockProductProvider } from "../providers/product.provider";
import { MockSearchProvider } from "../providers/search.provider";

export function withAlgoliaCapabilities(configuration: MockConfig, capabilities: Partial<MockCapabilities>) {
    const client = {} as Client;

    if (capabilities.products) {
        client.product = new MockProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new MockSearchProvider(configuration);
    }

    return client;
}
