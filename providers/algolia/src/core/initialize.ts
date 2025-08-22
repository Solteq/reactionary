import { Client, ProductMutationSchema, ProductQuerySchema, ProductSchema, SearchMutationSchema, SearchQuerySchema, RedisCache } from "@reactionary/core";
import { AlgoliaProductProvider } from "../providers/product.provider";
import { AlgoliaSearchProvider } from "../providers/search.provider";
import { AlgoliaCapabilities } from "../schema/capabilities.schema";
import { AlgoliaConfiguration } from "../schema/configuration.schema";
import { AlgoliaSearchResultSchema } from "../schema/search.schema";

export function withAlgoliaCapabilities(configuration: AlgoliaConfiguration, capabilities: AlgoliaCapabilities) {
    return (cache: RedisCache) => {
        const client: Partial<Client> = {};

        if (capabilities.product) {
            client.product = new AlgoliaProductProvider(configuration, ProductSchema, ProductQuerySchema, ProductMutationSchema, cache);
        }

        if (capabilities.search) {
            client.search = new AlgoliaSearchProvider(configuration, AlgoliaSearchResultSchema, SearchQuerySchema, SearchMutationSchema, cache);
        }

        return client;
    };
}
