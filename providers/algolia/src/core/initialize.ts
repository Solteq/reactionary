import { Client, ProductSchema, SearchResultSchema } from "@reactionary/core";
import { AlgoliaProductProvider } from "../providers/product.provider";
import { AlgoliaSearchProvider } from "../providers/search.provider";
import { AlgoliaCapabilities } from "../schema/capabilities.schema";
import { AlgoliaConfiguration } from "../schema/configuration.schema";

export function withAlgoliaCapabilities(configuration: AlgoliaConfiguration, capabilities: AlgoliaCapabilities) {
    const client: Partial<Client> = {};

    if (capabilities.product) {
        client.product = new AlgoliaProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new AlgoliaSearchProvider(configuration, SearchResultSchema);
    }

    return client;
}
