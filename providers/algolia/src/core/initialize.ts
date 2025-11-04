import type { Client, Cache } from "@reactionary/core";
import { ProductSchema, ProductSearchResultItemSchema } from "@reactionary/core";
import { AlgoliaProductProvider } from "../providers/product.provider.js";
import { AlgoliaSearchProvider } from "../providers/product-search.provider.js";
import type { AlgoliaCapabilities } from "../schema/capabilities.schema.js";
import type { AlgoliaConfiguration } from "../schema/configuration.schema.js";
import { AlgoliaSearchResultSchema } from "../schema/search.schema.js";

export function withAlgoliaCapabilities(configuration: AlgoliaConfiguration, capabilities: AlgoliaCapabilities) {
    return (cache: Cache) => {
        const client: Partial<Client> = {};

        if (capabilities.product) {
            client.product = new AlgoliaProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.productSearch) {
            client.productSearch = new AlgoliaSearchProvider(configuration, ProductSearchResultItemSchema, cache);
        }

        return client;
    };
}
