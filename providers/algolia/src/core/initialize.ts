import type { Client, Cache } from "@reactionary/core";
import { ProductSchema } from "@reactionary/core";
import { AlgoliaProductProvider } from "../providers/product.provider";
import { AlgoliaSearchProvider } from "../providers/search.provider";
import type { AlgoliaCapabilities } from "../schema/capabilities.schema";
import type { AlgoliaConfiguration } from "../schema/configuration.schema";
import { AlgoliaSearchResultSchema } from "../schema/search.schema";

export function withAlgoliaCapabilities(configuration: AlgoliaConfiguration, capabilities: AlgoliaCapabilities) {
    return (cache: Cache) => {
        const client: Partial<Client> = {};

        if (capabilities.product) {
            client.product = new AlgoliaProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.search) {
            client.search = new AlgoliaSearchProvider(configuration, AlgoliaSearchResultSchema, cache);
        }

        return client;
    };
}
