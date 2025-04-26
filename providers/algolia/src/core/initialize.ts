import { Client, ProductSchema } from "@reactionary/core";
import { AlgoliaCapabilities } from "./capabilities";
import { AlgoliaConfig } from "./configuration";
import { AlgoliaProductProvider } from "../providers/product.provider";
import { AlgoliaSearchProvider } from "../providers/search.provider";

export function withAlgoliaCapabilities(configuration: AlgoliaConfig, capabilities: Partial<AlgoliaCapabilities>) {
    const client = {} as Client;

    if (capabilities.products) {
        client.product = new AlgoliaProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new AlgoliaSearchProvider(configuration);
    }

    return client;
}
