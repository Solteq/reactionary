import { Client, ProductSchema } from "@reactionary/core";
import { AlgoliaProductProvider } from "../providers/product.provider";
import { AlgoliaSearchProvider } from "../providers/search.provider";
import { AlgoliaCapabilities } from "../schema/capabilities.schema";
import { AlgoliaConfiguration } from "../schema/configuration.schema";
import { AlgoliaSearchResultSchema } from "../schema/search.schema";
import { AlgoliaAnalyticsProvider } from "../providers/analytics.provider";

export function withAlgoliaCapabilities(configuration: AlgoliaConfiguration, capabilities: AlgoliaCapabilities) {
    const client: Partial<Client> = {};

    if (capabilities.product) {
        client.product = new AlgoliaProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new AlgoliaSearchProvider(configuration, AlgoliaSearchResultSchema);
    }

    if (capabilities.analytics) {
        client.analytics = [new AlgoliaAnalyticsProvider(configuration)];
    }

    return client;
}
